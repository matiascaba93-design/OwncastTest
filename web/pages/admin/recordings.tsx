import { ReactElement, useEffect, useState } from 'react';
import { Table, Button, Space, Popconfirm, message, Typography } from 'antd';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { fetchData, RECORDINGS } from '../../utils/apis';
import { formatBytes } from '../../utils/format';

type Recording = {
  name: string;
  size: number;
  createdAt: string;
};

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const data = await fetchData(RECORDINGS);
      setRecordings(data || []);
    } catch (err) {
      message.error((err as Error).message || 'Unable to load recordings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  const handleDelete = async (name: string) => {
    try {
      await fetchData(`${RECORDINGS}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      message.success('Recording deleted');
      loadRecordings();
    } catch (err) {
      message.error((err as Error).message || 'Unable to delete recording');
    }
  };

  const handleDownload = (name: string) => {
    window.open(`${RECORDINGS}/${encodeURIComponent(name)}`, '_blank');
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (value: number) => formatBytes(value),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Recording) => (
        <Space>
          <Button type="link" onClick={() => handleDownload(record.name)}>
            Download
          </Button>
          <Popconfirm
            title="Delete recording?"
            okText="Delete"
            cancelText="Cancel"
            onConfirm={() => handleDelete(record.name)}
          >
            <Button type="link" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="recordings-page">
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={loadRecordings} loading={loading}>
          Refresh
        </Button>
      </Space>
      {recordings.length === 0 ? (
        <Typography.Paragraph>No recordings have been saved yet.</Typography.Paragraph>
      ) : (
        <Table
          rowKey="name"
          dataSource={recordings}
          columns={columns}
          loading={loading}
          pagination={false}
        />
      )}
    </div>
  );
}

RecordingsPage.getLayout = function getLayout(page: ReactElement) {
  return <AdminLayout page={page} />;
};
