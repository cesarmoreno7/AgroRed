import type { NotificationChannel } from "../value-objects/NotificationChannel.js";
import type { NotificationStatus } from "../value-objects/NotificationStatus.js";

export interface NotificationProps {
  id: string;
  tenantId: string;
  incidentId: string | null;
  logisticsOrderId: string | null;
  offerId: string | null;
  notificationChannel: NotificationChannel;
  recipientLabel: string;
  title: string;
  message: string;
  scheduledFor: Date;
  status: NotificationStatus;
  createdAt?: Date;
}

export class Notification {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly incidentId: string | null;
  public readonly logisticsOrderId: string | null;
  public readonly offerId: string | null;
  public readonly notificationChannel: NotificationChannel;
  public readonly recipientLabel: string;
  public readonly title: string;
  public readonly message: string;
  public readonly scheduledFor: Date;
  public readonly status: NotificationStatus;
  public readonly createdAt: Date;

  constructor(props: NotificationProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.incidentId = props.incidentId;
    this.logisticsOrderId = props.logisticsOrderId;
    this.offerId = props.offerId;
    this.notificationChannel = props.notificationChannel;
    this.recipientLabel = props.recipientLabel.trim();
    this.title = props.title.trim();
    this.message = props.message.trim();
    this.scheduledFor = new Date(props.scheduledFor);
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
  }
}