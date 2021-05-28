export interface BasicCredentials {
	username: string;
	password: string;
}

// @fixme get it from core.declarations
export interface BasicLocation {
	countryCode: string | null;
	regionCode: string | null;
	city: string | null;
	timeZone: string | Record<string, any> | null;
	latitude: number | null;
	longitude: number | null;
	postalCode?: string | null;
}
