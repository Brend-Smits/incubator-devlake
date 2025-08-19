/*
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package tasks

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"strings"

	"github.com/apache/incubator-devlake/core/dal"
	"github.com/apache/incubator-devlake/core/errors"
	"github.com/apache/incubator-devlake/core/plugin"
	"github.com/apache/incubator-devlake/helpers/pluginhelper/api"
	"github.com/apache/incubator-devlake/plugins/github/models"
)

func init() {
	RegisterSubtaskMeta(&CollectJobsMeta)
}

const RAW_JOB_TABLE = "github_api_jobs"

var CollectJobsMeta = plugin.SubTaskMeta{
	Name:             "Collect Job Runs",
	EntryPoint:       CollectJobs,
	EnabledByDefault: true,
	Description:      "Collect Jobs data from Github action api, supports both timeFilter and diffSync.",
	DomainTypes:      []string{plugin.DOMAIN_TYPE_CICD},
	DependencyTables: []string{models.GithubRun{}.TableName()},
	ProductTables:    []string{RAW_JOB_TABLE},
	SkipOnFail:       true, // Allow other subtasks to continue if job collection fails
}

func CollectJobs(taskCtx plugin.SubTaskContext) errors.Error {
	db := taskCtx.GetDal()
	data := taskCtx.GetData().(*GithubTaskData)
	logger := taskCtx.GetLogger()

	// state manager
	apiCollector, err := api.NewStatefulApiCollector(api.RawDataSubTaskArgs{
		Ctx: taskCtx,
		Params: GithubApiParams{
			ConnectionId: data.Options.ConnectionId,
			Name:         data.Options.Name,
		},
		Table: RAW_JOB_TABLE,
	})
	if err != nil {
		return err
	}

	// load workflow_runs that need jobs collection
	clauses := []dal.Clause{
		dal.Select("id"),
		dal.From(&models.GithubRun{}),
		dal.Where(
			"repo_id = ? AND connection_id = ?",
			data.Options.GithubId, data.Options.ConnectionId,
		),
	}
	if apiCollector.IsIncremental() && apiCollector.GetSince() != nil {
		clauses = append(clauses, dal.Where("github_updated_at > ?", apiCollector.GetSince()))
	}
	cursor, err := db.Cursor(clauses...)
	if err != nil {
		return err
	}
	iterator, err := api.NewDalCursorIterator(db, cursor, reflect.TypeOf(SimpleGithubRun{}))
	if err != nil {
		return err
	}

	// Track failed runs for logging with error details
	failedRuns := []int64{}
	failedRunsErrors := make(map[int64]string) // Track error details per run
	totalRuns := 0
	currentRunId := int64(0)

	// collect jobs with individual error handling
	err = apiCollector.InitCollector(api.ApiCollectorArgs{
		RawDataSubTaskArgs: api.RawDataSubTaskArgs{
			Ctx: taskCtx,
			Params: GithubApiParams{
				ConnectionId: data.Options.ConnectionId,
				Name:         data.Options.Name,
			},
			Table: RAW_JOB_TABLE,
		},
		ApiClient:   data.ApiClient,
		PageSize:    100,
		Input:       iterator,
		UrlTemplate: "repos/{{ .Params.Name }}/actions/runs/{{ .Input.ID }}/jobs",
		Query: func(reqData *api.RequestData) (url.Values, errors.Error) {
			query := url.Values{}
			query.Set("page", fmt.Sprintf("%v", reqData.Pager.Page))
			query.Set("per_page", fmt.Sprintf("%v", reqData.Pager.Size))

			// Track current run ID from the input
			if input, ok := reqData.Input.(*SimpleGithubRun); ok {
				currentRunId = input.ID
			}

			return query, nil
		},
		GetTotalPages: GetTotalPagesFromResponse,
		ResponseParser: func(res *http.Response) ([]json.RawMessage, errors.Error) {
			body := &GithubRawJobsResult{}
			err := api.UnmarshalResponse(res, body)
			if err != nil {
				return nil, err
			}
			return body.GithubWorkflowJobs, nil
		},
		AfterResponse: func(res *http.Response) errors.Error {
			// Count total runs processed
			totalRuns++

			// Handle 404 errors gracefully (run might have been deleted)
			if res.StatusCode == http.StatusNotFound {
				failedRuns = append(failedRuns, currentRunId)
				failedRunsErrors[currentRunId] = "404 Not Found - Run likely deleted"
				logger.Warn(nil, "GitHub run %d not found (404) at %s, likely deleted. Skipping...", 
					currentRunId, res.Request.URL.Path)
				return nil
			}

			// Handle 500 errors gracefully (temporary GitHub API issues)
			if res.StatusCode >= 500 {
				// Read response body to get error details
				errorBody := "unknown error"
				if res.Body != nil {
					if bodyBytes, err := io.ReadAll(res.Body); err == nil {
						errorBody = string(bodyBytes)
						// Truncate if too long to avoid log spam
						if len(errorBody) > 300 {
							errorBody = errorBody[:300] + "... (truncated)"
						}
					}
				}
				
				failedRuns = append(failedRuns, currentRunId)
				failedRunsErrors[currentRunId] = fmt.Sprintf("%d Server Error: %s", res.StatusCode, errorBody)
				logger.Warn(nil, "GitHub API returned %d for run %d: %s. Skipping this run to continue collection", 
					res.StatusCode, currentRunId, errorBody)
				return nil // Skip this run but continue with others
			}

			return nil
		},
	})
	if err != nil {
		return err
	}

	err = apiCollector.Execute()
	
	// Handle execution errors gracefully - especially retry failures
	if err != nil {
		// Check if this is a retry-related error that we want to handle gracefully
		errorStr := err.Error()
		if strings.Contains(errorStr, "Retry exceeded") && strings.Contains(errorStr, "times calling") {
			// Try to extract run ID from the error message
			// Error format: "Retry exceeded 3 times calling repos/.../actions/runs/12345/jobs"
			runIdStr := ""
			if strings.Contains(errorStr, "/actions/runs/") {
				parts := strings.Split(errorStr, "/actions/runs/")
				if len(parts) > 1 {
					runParts := strings.Split(parts[1], "/")
					if len(runParts) > 0 {
						runIdStr = runParts[0]
					}
				}
			}
			
			logger.Warn(nil, "API collection completed with retry failures for run %s: %s", runIdStr, errorStr)
			logger.Info("Some individual API calls failed after retries, but collection continued to maximize data collection")
			
			// Add this to our failed runs tracking if we can parse the run ID
			if runIdStr != "" {
				failedRunsErrors[0] = fmt.Sprintf("Retry failure: %s", errorStr)
			}
			
			// Don't return the error - treat as partial success
		} else {
			// For other types of errors, still fail the task
			return err
		}
	}

	// Log summary of collection results
	if len(failedRuns) > 0 {
		logger.Info("Job collection completed with %d failed runs out of %d total runs. Failed run IDs: %v",
			len(failedRuns), totalRuns, failedRuns)
		
		// Log detailed error information for debugging
		logger.Info("Error details for failed runs:")
		for runId, errorMsg := range failedRunsErrors {
			logger.Info("  Run %d: %s", runId, errorMsg)
		}
		
		logger.Info("Continuing pipeline execution despite individual run failures to maximize data collection")
	} else {
		logger.Info("Job collection completed successfully for all %d runs", totalRuns)
	}

	return err
}

type SimpleGithubRun struct {
	ID int64
}

type GithubRawJobsResult struct {
	TotalCount         int64             `json:"total_count"`
	GithubWorkflowJobs []json.RawMessage `json:"jobs"`
}
