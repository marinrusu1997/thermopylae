/** Represents location from where HTTP request has been made. */
export interface HTTPRequestLocation {
	readonly countryCode: string | null;
	readonly regionCode: string | null;
	readonly city: string | null;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly timezone: string | null;
}
