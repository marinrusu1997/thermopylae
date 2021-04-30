import { Nullable } from '../mapped';

/**
 * HTTP device detector.
 *
 * @template    Request object type.
 */
export interface HttpDeviceDetector<Request> {
	/**
	 * Detect device from where HTTP request hsa been made.
	 *
	 * @param req   Request.
	 *
	 * @returns     Device.
	 */
	detect(req: Request): HttpDevice | null;
}

/**
 * Device from where HTTP request hsa been made.
 */
export interface HttpDevice {
	/**
	 * Client which made HTTP request.
	 */
	client: Nullable<{
		type: string;
		name: string;
		version: string;
	}>;
	/**
	 * Device from where HTTP request has been made.
	 */
	device: Nullable<{
		type: DeviceType;
		brand: string;
		model: string;
	}>;
	/**
	 * Operating System of the device.
	 */
	os: Nullable<{
		name: string;
		version: string;
		platform: 'ARM' | 'x64' | 'x86' | '';
	}>;
	/**
	 * Whether request has been made by bot.
	 */
	bot: Nullable<{
		name: string;
		category: string;
		url: string;
		producer: {
			name: string;
			url: string;
		};
	}>;
}

/**
 * Type of the device.
 */
export type DeviceType = '' | 'desktop' | 'smartphone' | 'tablet' | 'television' | 'smart display' | 'camera' | 'car' | 'console' | 'portable media player';
