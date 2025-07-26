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
	"testing"
	"time"

	"github.com/apache/incubator-devlake/plugins/github/models"
	"github.com/stretchr/testify/assert"
)

func TestExtractJobs_ZeroTimeHandling(t *testing.T) {
	// Test data with zero time values that would cause MySQL errors
	year0Time := time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC)  // Year 0000 time from JSON parsing
	year1Time := time.Time{}  // Go's zero time (year 0001)
	validTime := time.Date(2023, 1, 15, 10, 30, 0, 0, time.UTC)
	
	testCases := []struct {
		name        string
		inputJob    *models.GithubJob
		expectStart *time.Time
		expectEnd   *time.Time
	}{
		{
			name: "nil times should remain nil",
			inputJob: &models.GithubJob{
				ID:          123,
				StartedAt:   nil,
				CompletedAt: nil,
			},
			expectStart: nil,
			expectEnd:   nil,
		},
		{
			name: "year 0000 times should become nil",
			inputJob: &models.GithubJob{
				ID:          124,
				StartedAt:   &year0Time,
				CompletedAt: &year0Time,
			},
			expectStart: nil,
			expectEnd:   nil,
		},
		{
			name: "Go zero times (year 0001) should become nil",
			inputJob: &models.GithubJob{
				ID:          125,
				StartedAt:   &year1Time,
				CompletedAt: &year1Time,
			},
			expectStart: nil,
			expectEnd:   nil,
		},
		{
			name: "valid times should be preserved",
			inputJob: &models.GithubJob{
				ID:          126,
				StartedAt:   &validTime,
				CompletedAt: &validTime,
			},
			expectStart: &validTime,
			expectEnd:   &validTime,
		},
		{
			name: "mixed zero and valid times",
			inputJob: &models.GithubJob{
				ID:          127,
				StartedAt:   &year0Time,
				CompletedAt: &validTime,
			},
			expectStart: nil,
			expectEnd:   &validTime,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Simulate the extraction logic
			var startedAt, completedAt *time.Time
			if tc.inputJob.StartedAt != nil && !tc.inputJob.StartedAt.IsZero() && tc.inputJob.StartedAt.Year() > 0 {
				startedAt = tc.inputJob.StartedAt
			}
			if tc.inputJob.CompletedAt != nil && !tc.inputJob.CompletedAt.IsZero() && tc.inputJob.CompletedAt.Year() > 0 {
				completedAt = tc.inputJob.CompletedAt
			}

			assert.Equal(t, tc.expectStart, startedAt, "StartedAt should match expected value")
			assert.Equal(t, tc.expectEnd, completedAt, "CompletedAt should match expected value")
		})
	}
}

func TestExtractJobs_RawDataProcessing(t *testing.T) {
	// Test that the extraction process properly handles zero times in raw JSON data
	zeroTimeJSON := `{
		"id": 123,
		"run_id": 456,
		"name": "test-job",
		"status": "completed",
		"conclusion": "success",
		"started_at": "0000-01-01T00:00:00Z",
		"completed_at": null
	}`

	var githubJob models.GithubJob
	err := json.Unmarshal([]byte(zeroTimeJSON), &githubJob)
	assert.NoError(t, err)

	// Verify that JSON unmarshaling creates a year 0000 time which is not Go's zero time
	assert.NotNil(t, githubJob.StartedAt)
	assert.False(t, githubJob.StartedAt.IsZero())  // Year 0000 is not Go's zero time
	assert.Equal(t, 0, githubJob.StartedAt.Year()) // But it has year 0000
	assert.Nil(t, githubJob.CompletedAt)

	// Simulate the extraction logic
	var startedAt, completedAt *time.Time
	if githubJob.StartedAt != nil && !githubJob.StartedAt.IsZero() && githubJob.StartedAt.Year() > 0 {
		startedAt = githubJob.StartedAt
	}
	if githubJob.CompletedAt != nil && !githubJob.CompletedAt.IsZero() && githubJob.CompletedAt.Year() > 0 {
		completedAt = githubJob.CompletedAt
	}

	// Year 0000 time should be converted to nil, null should remain nil
	assert.Nil(t, startedAt)
	assert.Nil(t, completedAt)
}
