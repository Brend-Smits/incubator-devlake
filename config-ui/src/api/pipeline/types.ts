/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

export type SubTasksRes = {
  completionRate: number;
  status: string;
  count: number;
  subtasks: Array<{
    id: number;
    pipelineId: number;
    createdAt: string;
    updatedAt: string;
    beganAt?: string;
    finishedAt?: string;
    plugin: string;
    options: {
      fullName?: string;
      name?: string;
      [key: string]: any;
    };
    status: string;
    failedSubTask?: string;
    message?: string;
    errorName?: string;
    spentSeconds: number;
    subtaskDetails: Array<{
      id: number;
      createdAt: string;
      updatedAt: string;
      taskId: number;
      name: string;
      number: number;
      beganAt?: string;
      finishedAt?: string;
      spentSeconds: number;
      finishedRecords: number;
      sequence: number;
      isCollector: boolean;
      isFailed: boolean;
      message?: string;
    }>;
  }>;
};
