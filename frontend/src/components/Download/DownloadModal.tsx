import { useState } from "react";
import { Modal, Form, Radio, Button, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { downloadApi, videoApi } from "../../services/api";
import type { Video } from "../../types";

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  video: Video;
}

export default function DownloadModal({
  visible,
  onClose,
  video,
}: DownloadModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { format: string }) => {
    setLoading(true);
    try {
      // 如果 cid 为空，先获取视频详情
      let cid = video.cid;
      if (!cid) {
        const { data } = await videoApi.getDetail(video.bvid);
        if (data.code === 0 && data.data.pages && data.data.pages.length > 0) {
          cid = String(data.data.pages[0].cid);
        }
      }

      if (!cid) {
        message.error("无法获取视频 CID");
        setLoading(false);
        return;
      }

      const { data } = await downloadApi.create({
        bvid: video.bvid,
        cid: cid,
        title: video.title,
        format: values.format,
      });

      if (data.code === 0) {
        message.success("下载任务已创建，请在下载管理中查看进度");
        onClose();
      }
    } catch (error) {
      message.error("创建下载任务失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="下载" open={visible} onCancel={onClose} footer={null}>
      <Form
        form={form}
        onFinish={handleSubmit}
        layout="vertical"
        initialValues={{ format: "mp3" }}
      >
        <Form.Item
          name="format"
          label="选择格式"
          rules={[{ required: true, message: "请选择下载格式" }]}
        >
          <Radio.Group>
            <Radio.Button value="mp3">MP3 音频</Radio.Button>
            <Radio.Button value="mp4">MP4 视频</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<DownloadOutlined />}
            loading={loading}
            block
            style={{ background: "#fb7299", borderColor: "#fb7299" }}
          >
            开始下载
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
