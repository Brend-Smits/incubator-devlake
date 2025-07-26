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
  BarChartOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { Button, Modal, Table, Tag, Progress, Statistic, Row, Col, Card } from 'antd';

import API from '@/api';
import { Loading } from '@/components';
import { useAutoRefresh } from '@/hooks';
import { SubTasksRes } from '@/api/pipeline/types';
import { ITask, IPipelineStatus } from '@/types';
import { DEVLAKE_ENDPOINT } from '@/config';

interface Props {
  pipelineId: ID;
  tasks: ITask[];
}

interface SubtaskDetail {
  name: string;
  beganAt?: string;
  finishedAt?: string;
  isFailed?: boolean;
  sequence: number;
  finishedRecords?: number;
}

interface TaskWithSubtasks {
  id: number;
  plugin: string;
  options?: {
    name?: string;
    fullName?: string;
    [key: string]: any;
  };
  subtaskDetails?: SubtaskDetail[];
  beganAt?: string;
  finishedAt?: string;
}

/**
 * Formats a duration between two timestamps into a human-readable string
 * @param startTime - The start timestamp
 * @param endTime - The end timestamp (defaults to current time if not provided)
 * @returns Formatted duration string (e.g., "2m 30s", "1h 15m 30s")
 */
const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const duration = Math.floor((end - start) / 1000);
  
  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

/**
 * PipelineOverview Component
 * 
 * Displays a comprehensive overview of pipeline execution including:
 * - Overall progress statistics
 * - Individual task progress cards with Task IDs
 * - Detailed subtasks table with latest attempts only
 * - Log download functionality
 * 
 * @param pipelineId - The ID of the pipeline to display
 * @param tasks - Array of tasks in the pipeline
 */
export const PipelineOverview = ({ pipelineId, tasks }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: subtasksData, loading } = useAutoRefresh<SubTasksRes>(
    async () => {
      const response = await API.pipeline.subTasks(pipelineId);
      return response;
    },
    [],
    {
      cancel: (data) => {
        return !!(
          data &&
          tasks.every(task => 
            [IPipelineStatus.COMPLETED, IPipelineStatus.FAILED, IPipelineStatus.CANCELLED].includes(task.status)
          )
        );
      },
    },
  );

  if (loading || !subtasksData) {
    return (
      <>
        <Button 
          type="primary"
          size="small"
          icon={<BarChartOutlined />}
          onClick={() => setIsModalOpen(true)}
          disabled
        >
          Pipeline Overview
        </Button>
        <Modal
          title="Pipeline Overview"
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          width={1200}
        >
          <Loading />
        </Modal>
      </>
    );
  }

  // Aggregate data for all tasks with proper typing
  const allSubtasks = subtasksData.subtasks.flatMap((task: TaskWithSubtasks) => 
    (task.subtaskDetails || []).map(detail => ({
      ...detail,
      taskId: task.id,
      taskPlugin: task.plugin,
      taskName: task.options?.fullName || task.options?.name || 'Unknown',
      status: detail.isFailed ? 'FAILED' : detail.finishedAt ? 'COMPLETED' : detail.beganAt ? 'RUNNING' : 'PENDING',
      taskBeganAt: task.beganAt,
      taskFinishedAt: task.finishedAt
    }))
  );

  // Calculate statistics using latest attempts only
  const latestSubtasksMap = new Map();
  allSubtasks.forEach(subtask => {
    const key = `${subtask.taskId}-${subtask.name}`;
    if (!latestSubtasksMap.has(key) || 
        new Date(subtask.beganAt || '').getTime() > new Date(latestSubtasksMap.get(key).beganAt || '').getTime()) {
      latestSubtasksMap.set(key, subtask);
    }
  });
  const latestSubtasks = Array.from(latestSubtasksMap.values());

  const totalSubtasks = latestSubtasks.length;
  const completedSubtasks = latestSubtasks.filter(s => s.status === 'COMPLETED').length;
  const runningSubtasks = latestSubtasks.filter(s => s.status === 'RUNNING').length;
  const failedSubtasks = latestSubtasks.filter(s => s.status === 'FAILED').length;
  const pendingSubtasks = latestSubtasks.filter(s => s.status === 'PENDING').length;

  const overallProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Task summary for cards - show all tasks with proper typing
  const taskSummary = subtasksData.subtasks.map((task: TaskWithSubtasks) => {
    const taskSubtasks = task.subtaskDetails || [];
    // Group by subtask name and get latest attempt for each
    const latestTaskSubtasks = Object.values(
      taskSubtasks.reduce((acc: Record<string, SubtaskDetail>, subtask: SubtaskDetail) => {
        const key = subtask.name;
        if (!acc[key] || new Date(subtask.beganAt || '').getTime() > new Date(acc[key].beganAt || '').getTime()) {
          acc[key] = subtask;
        }
        return acc;
      }, {})
    );
    
    const taskCompleted = latestTaskSubtasks.filter(s => s.finishedAt).length;
    const taskTotal = latestTaskSubtasks.length;
    const taskProgress = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;
    const currentlyRunning = latestTaskSubtasks.find(s => s.beganAt && !s.finishedAt);
    
    // Find the corresponding task status
    const taskInfo = tasks.find(t => t.id === task.id);
    const taskStatus = taskInfo?.status || IPipelineStatus.PENDING;

    return {
      ...task,
      taskStatus,
      taskProgress,
      taskCompleted,
      taskTotal,
      currentlyRunning,
      taskName: task.options?.fullName || task.options?.name || 'Unknown'
    };
  });

  // Table data for detailed view - show only latest attempts for each subtask
  const tableLatestSubtasksMap = new Map();
  allSubtasks.forEach(subtask => {
    const key = `${subtask.taskId}-${subtask.name}`;
    if (!tableLatestSubtasksMap.has(key) || 
        new Date(subtask.beganAt || '').getTime() > new Date(tableLatestSubtasksMap.get(key).beganAt || '').getTime()) {
      tableLatestSubtasksMap.set(key, subtask);
    }
  });

  const tableData = Array.from(tableLatestSubtasksMap.values())
    .sort((a, b) => {
      // Sort by task ID first, then by subtask name
      if (a.taskId !== b.taskId) {
        return a.taskId - b.taskId;
      }
      return a.name.localeCompare(b.name);
    })
    .map((subtask, index) => ({
      key: `${subtask.taskId}-${subtask.name}-latest`,
      ...subtask,
      duration: subtask.beganAt ? formatDuration(subtask.beganAt, subtask.finishedAt) : '-'
    }));

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      fixed: 'left' as const,
      filters: [
        { text: 'Completed', value: 'COMPLETED' },
        { text: 'Running', value: 'RUNNING' },
        { text: 'Failed', value: 'FAILED' },
        { text: 'Pending', value: 'PENDING' },
      ],
      onFilter: (value: any, record: any) => record.status === value,
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactElement }> = {
          'COMPLETED': { color: 'success', icon: <CheckCircleOutlined /> },
          'RUNNING': { color: 'processing', icon: <LoadingOutlined /> },
          'FAILED': { color: 'error', icon: <CloseCircleOutlined /> },
          'PENDING': { color: 'default', icon: <ClockCircleOutlined /> }
        };
        const { color, icon } = config[status] || config['PENDING'];
        return (
          <Tag color={color} icon={icon} style={{ margin: 0, fontSize: '11px', padding: '2px 6px' }}>
            {status}
          </Tag>
        );
      }
    },
    {
      title: 'Task ID',
      dataIndex: 'taskId',
      width: 80,
      fixed: 'left' as const,
      sorter: (a: any, b: any) => a.taskId - b.taskId,
      render: (taskId: number) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 500 }}>
          {taskId}
        </span>
      )
    },
    {
      title: 'Task',
      dataIndex: 'taskPlugin',
      width: 160,
      filters: taskSummary.map(task => ({ text: `${task.plugin}: ${task.taskName}`, value: task.plugin })),
      onFilter: (value: any, record: any) => record.taskPlugin === value,
      render: (plugin: string, record: any) => (
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {plugin}
          </div>
          <div style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {record.taskName}
          </div>
        </div>
      )
    },
    {
      title: 'Subtask',
      dataIndex: 'name',
      width: 220,
      ellipsis: { showTitle: true },
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (name: string) => (
        <span title={name} style={{ fontSize: '12px' }}>
          {name}
        </span>
      )
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      width: 100,
      align: 'right' as const,
      sorter: (a: any, b: any) => {
        const getDurationSeconds = (duration: string) => {
          if (duration === '-') return 0;
          const parts = duration.match(/(\d+)([hms])/g) || [];
          return parts.reduce((total, part) => {
            const value = parseInt(part);
            const unit = part.slice(-1);
            if (unit === 'h') return total + value * 3600;
            if (unit === 'm') return total + value * 60;
            return total + value;
          }, 0);
        };
        return getDurationSeconds(a.duration) - getDurationSeconds(b.duration);
      },
    },
    {
      title: 'Records',
      dataIndex: 'finishedRecords',
      width: 100,
      align: 'right' as const,
      sorter: (a: any, b: any) => (a.finishedRecords || 0) - (b.finishedRecords || 0),
      render: (records: number) => records > 0 ? records.toLocaleString() : '-'
    },
    {
      title: 'Started At',
      dataIndex: 'beganAt',
      width: 140,
      sorter: (a: any, b: any) => {
        if (!a.beganAt && !b.beganAt) return 0;
        if (!a.beganAt) return 1;
        if (!b.beganAt) return -1;
        return new Date(a.beganAt).getTime() - new Date(b.beganAt).getTime();
      },
      render: (beganAt: string) => beganAt ? new Date(beganAt).toLocaleTimeString() : '-'
    },
    {
      title: 'Actions',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button
          type="link"
          size="small"
          icon={<DownloadOutlined />}
          onClick={async () => {
            try {
              // Download logs for the entire pipeline (logs are per pipeline, not per task)
              const res = await API.pipeline.log(pipelineId);
              if (res) {
                const link = document.createElement('a');
                link.href = `${DEVLAKE_ENDPOINT}/pipelines/${pipelineId}/logging.tar.gz`;
                link.download = `pipeline-${pipelineId}-logs.tar.gz`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            } catch (error) {
              console.error('Failed to download logs:', error);
            }
          }}
          title={`Download pipeline logs`}
        >
          Logs
        </Button>
      )
    }
  ];

  return (
    <>
      <Button 
        type="primary"
        size="small"
        icon={<BarChartOutlined />}
        onClick={() => setIsModalOpen(true)}
      >
        Pipeline Overview
      </Button>

      <Modal
        title={`Pipeline Overview - ${pipelineId}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={1400}
        styles={{
          body: { padding: '20px 0' }
        }}
      >
        {/* Overall Statistics */}
        <div style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic 
                  title="Overall Progress" 
                  value={overallProgress} 
                  suffix="%" 
                  prefix={<Progress 
                    type="circle" 
                    percent={overallProgress} 
                    size={40} 
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                  />} 
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Completed" value={completedSubtasks} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Running" value={runningSubtasks} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Failed" value={failedSubtasks} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Pending" value={pendingSubtasks} valueStyle={{ color: '#d9d9d9' }} />
              </Card>
            </Col>
            <Col span={2}>
              <Card size="small">
                <Statistic title="Total" value={totalSubtasks} />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Task Summary Cards */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 12 }}>Task Progress</h4>
          <Row gutter={[12, 12]}>
            {taskSummary.map(task => (
              <Col span={8} key={task.id}>
                <Card size="small" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={
                        task.taskStatus === IPipelineStatus.COMPLETED ? 'success' :
                        task.taskStatus === IPipelineStatus.FAILED ? 'error' :
                        [IPipelineStatus.ACTIVE, IPipelineStatus.RUNNING].includes(task.taskStatus) ? 'processing' : 'default'
                      }>
                        {task.taskStatus}
                      </Tag>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 500, color: '#666' }}>
                        Task {task.id}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: '#666' }}>
                      {task.taskCompleted}/{task.taskTotal}
                    </span>
                  </div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{task.plugin}</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{task.taskName}</div>
                  <Progress percent={task.taskProgress} size="small" />
                  {task.currentlyRunning && (
                    <div style={{ fontSize: 11, color: '#1890ff', marginTop: 4 }}>
                      <LoadingOutlined style={{ marginRight: 4 }} />
                      {(task.currentlyRunning as SubtaskDetail).name || 'Running...'}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Detailed Table */}
        <div>
          <h4 style={{ marginBottom: 12 }}>Subtasks Details (Latest Attempts)</h4>
          <Table
            columns={columns}
            dataSource={tableData}
            pagination={false}
            scroll={{ x: 1400, y: 400 }}
            size="small"
            rowKey="key"
          />
        </div>
      </Modal>
    </>
  );
};
