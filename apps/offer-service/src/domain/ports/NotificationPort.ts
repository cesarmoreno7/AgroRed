/**
 * Puerto para registrar notificaciones de sugerencia de abastecimiento.
 * Invoca al notification-service via HTTP para crear notificaciones persistidas.
 */
export interface NotificationPort {
  registerOfferMatchNotification(params: OfferMatchNotificationParams): Promise<void>;
}

export interface OfferMatchNotificationParams {
  tenantId: string;
  offerId: string;
  recipientLabel: string;
  title: string;
  message: string;
}
