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

import { useState } from 'react';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  LoadingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Button, Progress, Modal, Table, Tag, Tooltip } from 'antd';

import API from '@/api';
import { Loading, TextTooltip } from '@/components';
import { useAutoRefresh } from '@/hooks';
import { SubTasksRes } from '@/api/pipeline/types';
import { IPipelineStatus } from '@/types';

interface Props {
  pipelineId: ID;
  taskStatus: IPipelineStatus;
  message?: string;
  taskId?: ID; // Add task ID to identify the specific task
}

const formatDuration = (startTime: string, endTime?: string): string => {
  if (!startTime) return '-';
  
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
  
  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const getSubtaskStatusIcon = (subtask: any) => {
  const hasRunningSubtasks = subtask.subtaskDetails?.some((detail: any) => 
    detail.beganAt && !detail.finishedAt
  );
  
  if (hasRunningSubtasks || subtask.status === 'TASK_RUNNING') {
    return <LoadingOutlined style={{ color: '#1890ff' }} />;
  }
  
  const hasFailedSubtasks = subtask.subtaskDetails?.some((detail: any) => detail.isFailed);
  if (hasFailedSubtasks || subtask.status === 'TASK_FAILED') {
    return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  }
  
  if (subtask.status === 'TASK_COMPLETED') {
    return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  }
  
  return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
};

const getSubtaskProgress = (subtask: any): number => {
  if (!subtask.subtaskDetails?.length) return 0;
  
  const total = subtask.subtaskDetails.length;
  const completed = subtask.subtaskDetails.filter((detail: any) => detail.finishedAt).length;
  
  return Math.round((completed / total) * 100);
};

export const SubtaskProgress = ({ pipelineId, taskStatus, message, taskId }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: subtasksData } = useAutoRefresh<SubTasksRes>(
    async () => {
      const response = await API.pipeline.subTasks(pipelineId);
      return response;
    },
    [],
    {
      cancel: (data) => {
        return !!(
          data &&
          ![IPipelineStatus.ACTIVE, IPipelineStatus.RUNNING].includes(taskStatus)
        );
      },
    },
  );

  if (!subtasksData) {
    return (
      <div style={{ paddingLeft: 26, margin: 0, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Loading subtask details...</span>
          <Button 
            type="text" 
            size="small"
            style={{ fontSize: 11, padding: '0 4px', height: 20 }}
            icon={<InfoCircleOutlined />}
            disabled
          >
            Details
          </Button>
        </div>
      </div>
    );
  }

  // Find the specific task
  const currentTask = subtasksData.subtasks.find(task => task.id === taskId);
  
  if (!currentTask) {
    return (
      <div style={{ paddingLeft: 26, margin: 0, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Subtask details not available</span>
          <Button 
            type="text" 
            size="small"
            style={{ fontSize: 11, padding: '0 4px', height: 20 }}
            icon={<InfoCircleOutlined />}
            disabled
          >
            Details
          </Button>
        </div>
      </div>
    );
  }

  const currentRunningSubtask = subtasksData.subtasks
    .flatMap(task => 
      task.subtaskDetails?.map(detail => ({
        ...detail,
        taskPlugin: task.plugin,
        taskOptions: task.options
      })) || []
    )
    .find(detail => detail.beganAt && !detail.finishedAt);

  const totalSubtasks = subtasksData.subtasks.reduce(
    (sum, task) => sum + (task.subtaskDetails?.length || 0), 
    0
  );
  
  const completedSubtasks = subtasksData.subtasks.reduce(
    (sum, task) => sum + (task.subtaskDetails?.filter(detail => detail.finishedAt).length || 0), 
    0
  );

  // Prepare data for the modal table - only for the current task
  const modalData = currentTask.subtaskDetails?.map(detail => ({
    key: `${currentTask.plugin}-${detail.sequence}`,
    taskPlugin: currentTask.plugin,
    taskName: currentTask.options?.fullName || currentTask.options?.name || 'Unknown',
    subtaskName: detail.name,
    status: detail.isFailed ? 'FAILED' : detail.finishedAt ? 'COMPLETED' : detail.beganAt ? 'RUNNING' : 'PENDING',
    sequence: detail.sequence,
    beganAt: detail.beganAt,
    finishedAt: detail.finishedAt,
    records: detail.finishedRecords || 0,
    duration: detail.beganAt ? formatDuration(detail.beganAt, detail.finishedAt) : '-'
  })).sort((a, b) => a.sequence - b.sequence) || [];

  // Also update the progress calculations to be task-specific
  const taskSpecificSubtasks = currentTask.subtaskDetails || [];
  const taskTotalSubtasks = taskSpecificSubtasks.length;
  const taskCompletedSubtasks = taskSpecificSubtasks.filter(detail => detail.finishedAt).length;
  const taskCurrentRunningSubtask = taskSpecificSubtasks.find(detail => detail.beganAt && !detail.finishedAt);

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactElement }> = {
          'COMPLETED': { color: 'success', icon: <CheckCircleOutlined /> },
          'RUNNING': { color: 'processing', icon: <LoadingOutlined /> },
          'FAILED': { color: 'error', icon: <CloseCircleOutlined /> },
          'PENDING': { color: 'default', icon: <ClockCircleOutlined /> }
        };
        const { color, icon } = config[status] || config['PENDING'];
        return <Tag color={color} icon={icon}>{status}</Tag>;
      }
    },
    {
      title: 'Subtask Name',
      dataIndex: 'subtaskName',
      ellipsis: true,
      width: 300,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      width: 100,
      align: 'right' as const,
    },
    {
      title: 'Records',
      dataIndex: 'records',
      width: 100,
      align: 'right' as const,
      render: (records: number) => records > 0 ? records.toLocaleString() : '-'
    },
    {
      title: 'Started At',
      dataIndex: 'beganAt',
      width: 140,
      render: (beganAt: string) => beganAt ? new Date(beganAt).toLocaleTimeString() : '-'
    }
  ];

  return (
    <>
      <div style={{ paddingLeft: 26, margin: 0, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {[IPipelineStatus.ACTIVE, IPipelineStatus.RUNNING].includes(taskStatus) ? (
              <>
                Subtasks running: <strong>{taskCompletedSubtasks}/{taskTotalSubtasks}</strong>
                {taskCurrentRunningSubtask && (
                  <span style={{ marginLeft: 8, color: '#1890ff' }}>
                    <LoadingOutlined style={{ marginRight: 4 }} />
                    {taskCurrentRunningSubtask.name}
                  </span>
                )}
              </>
            ) : taskStatus === IPipelineStatus.COMPLETED ? (
              <>All subtasks completed: <strong>{taskTotalSubtasks}/{taskTotalSubtasks}</strong></>
            ) : taskStatus === IPipelineStatus.FAILED ? (
              <TextTooltip content={message || 'Task failed'}>
                <span className="error" style={{ color: '#f5222d' }}>
                  Task failed: <strong>{taskCompletedSubtasks}/{taskTotalSubtasks}</strong> - hover to view reason
                </span>
              </TextTooltip>
            ) : taskStatus === IPipelineStatus.CANCELLED ? (
              <>Subtasks canceled: <strong>{taskCompletedSubtasks}/{taskTotalSubtasks}</strong></>
            ) : [taskStatus === IPipelineStatus.CREATED, IPipelineStatus.PENDING].includes(taskStatus) ? (
              <>Subtasks pending: <strong>0/{taskTotalSubtasks}</strong></>
            ) : (
              <>Subtasks: <strong>{taskCompletedSubtasks}/{taskTotalSubtasks}</strong></>
            )}
          </span>
          <Button 
            type="text" 
            size="small"
            style={{ fontSize: 11, padding: '0 4px', height: 20 }}
            icon={<InfoCircleOutlined />}
            onClick={() => setIsModalOpen(true)}
          >
            Details
          </Button>
        </div>
      </div>

      <Modal
        title={`Subtask Details - ${currentTask?.plugin || 'Task'}: ${currentTask?.options?.fullName || currentTask?.options?.name || 'Unknown'}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={1000}
        styles={{
          body: { padding: '16px 0' }
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color={taskStatus === IPipelineStatus.COMPLETED ? 'success' : 
                     taskStatus === IPipelineStatus.FAILED ? 'error' : 
                     [IPipelineStatus.ACTIVE, IPipelineStatus.RUNNING].includes(taskStatus) ? 'processing' : 'default'}>
            {taskStatus}
          </Tag>
          <span style={{ marginLeft: 8 }}>
            Progress: {taskCompletedSubtasks}/{taskTotalSubtasks} subtasks completed
          </span>
          {taskCurrentRunningSubtask && (
            <span style={{ marginLeft: 16, color: '#1890ff' }}>
              <LoadingOutlined style={{ marginRight: 4 }} />
              Currently running: {taskCurrentRunningSubtask.name}
            </span>
          )}
        </div>
        
        <Table
          columns={columns}
          dataSource={modalData}
          pagination={false}
          scroll={{ y: 400 }}
          size="small"
        />
      </Modal>
    </>
  );
};
