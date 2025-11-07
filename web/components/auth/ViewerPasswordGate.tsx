import { FC, useState } from 'react';
import { useRecoilState } from 'recoil';
import { Button, Form, Input, Typography, Alert } from 'antd';
import { ViewerAccessService } from '../../services/viewer-access-service';
import { ViewerAccessState, viewerAccessStateAtom } from '../stores/ClientConfigStore';

import styles from './ViewerPasswordGate.module.scss';

export const ViewerPasswordGate: FC = () => {
  const [viewerAccessState, setViewerAccessState] = useRecoilState(viewerAccessStateAtom);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>(null);

  if (viewerAccessState !== ViewerAccessState.Required) {
    return null;
  }

  const handleSubmit = async ({ password }: { password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await ViewerAccessService.authenticate(password.trim());
      setViewerAccessState(ViewerAccessState.Authorized);
      form.resetFields();
    } catch (authError) {
      setError(authError.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <Typography.Title level={3}>Access Required</Typography.Title>
        <Typography.Paragraph>
          This stream is private. Enter the password shared with you to continue.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="password"
            label="Event Password"
            rules={[{ required: true, message: 'Please enter the password.' }]}
          >
            <Input.Password autoFocus disabled={submitting} placeholder="Password" size="large" />
          </Form.Item>
          {error && <Alert type="error" message={error} showIcon className={styles.errorAlert} />}
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} size="large">
              Unlock Stream
            </Button>
          </Form.Item>
        </Form>
        <Typography.Paragraph className={styles.helpText}>
          Having trouble? Reach out to the event host for the latest password.
        </Typography.Paragraph>
      </div>
    </div>
  );
};
