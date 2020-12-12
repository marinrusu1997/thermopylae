import { EmailClient, SentMessageInfo } from '@marin/lib.email';
import { hostname } from 'os';

function sendNotificationGeoIpLiteDbReloadedToAdminEmail(mailer: EmailClient, email: string, status: string): Promise<SentMessageInfo> {
	return mailer.send(
		{ to: email, subject: 'GeoIp Lite Db Reloaded', text: `Process with pid ${process.pid} under ${hostname()} reloaded geo ip lite db with ${status}.` },
		true
	);
}

export { sendNotificationGeoIpLiteDbReloadedToAdminEmail };
