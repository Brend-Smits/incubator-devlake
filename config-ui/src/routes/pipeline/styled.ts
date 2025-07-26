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

import styled from 'styled-components';

export const StatusWrapper = styled.div`
  &.ready,
  &.cancel {
    color: #94959f;
  }

  &.loading {
    color: #7497f7;
  }

  &.success {
    color: #4db764;
  }

  &.error {
    color: #f5222d;
  }
`;

export const Info = styled.div`
  ul {
    display: flex;
    align-items: center;
  }

  li {
    flex: 5;
    display: flex;
    flex-direction: column;

    &:last-child {
      flex: 1;
    }

    & > span {
      font-size: 12px;
      color: #94959f;
      text-align: center;
    }

    & > strong {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 8px;
    }
  }

  p.message {
    margin: 8px 0 0;
    color: #f5222d;
  }
`;

export const Tasks = styled.div`
  position: relative;
  padding-right: 36px;

  .inner {
    overflow: auto;
  }

  .collapse-control {
    position: absolute;
    right: 0;
    top: 0;
  }
`;

export const TasksHeader = styled.ul`
  display: flex;
  align-items: center;

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 0 0 30%;
    padding: 8px 12px;

    &.ready,
    &.cancel {
      color: #94959f;
      background-color: #f9f9fa;
    }

    &.loading {
      color: #7497f7;
      background-color: #e9efff;
    }

    &.success {
      color: #4db764;
      background-color: #edfbf0;
    }

    &.error {
      color: #e34040;
      background-color: #feefef;
    }
  }

  li + li {
    margin-left: 16px;
  }
`;

export const TasksList = styled.ul`
  display: flex;
  align-items: flex-start;

  li {
    flex: 0 0 30%;
    padding-bottom: 8px;
    overflow: hidden;
  }

  li + li {
    margin-left: 16px;
  }
`;

export const Task = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  height: 80px;
  border-bottom: 1px solid #dbe4fd;
  box-sizing: border-box;

  .info {
    flex: auto;
    overflow: hidden;

    .title {
      display: flex;
      align-items: center;
      margin-bottom: 8px;

      & > img {
        width: 20px;
      }

      & > strong {
        margin: 0 4px;
      }

      & > span {
        flex: auto;
        overflow: hidden;
      }
    }

    p {
      padding-left: 26px;
      margin: 0;
      font-size: 12px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;

      &.error {
        color: #f5222d;
      }
    }
  }

  .duration {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 0 80px;
    text-align: right;
  }
`;

export const SubtaskProgressContainer = styled.div`
  margin-top: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #fafafa;

  .subtask-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #e8e8e8;

    .progress-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .current-subtask {
        font-size: 12px;
        color: #1890ff;
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }

  .subtask-details {
    padding: 8px;
    max-height: 400px;
    overflow-y: auto;

    .task-group {
      margin-bottom: 16px;

      .task-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: white;
        border-radius: 4px;
        margin-bottom: 8px;

        .task-name {
          font-weight: 500;
          flex: 1;
        }
      }

      .subtask-list {
        padding-left: 16px;

        .subtask-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 2px;

          &:hover {
            background: #f0f0f0;
          }

          .subtask-status {
            flex: 0 0 16px;
          }

          .subtask-info {
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;

            .subtask-name {
              font-size: 13px;
            }

            .subtask-meta {
              display: flex;
              gap: 8px;
              font-size: 11px;
              color: #8c8c8c;

              .duration {
                color: #1890ff;
              }

              .records {
                color: #52c41a;
              }
            }
          }
        }
      }
    }
  }
`;
