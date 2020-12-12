export interface BasicCredentials {
	username: string;
	password: string;
}

export interface BasicLocation {
	countryCode: string | null;
	regionCode: string | null;
	city: string | null;
	timeZone: string | object | null;
	latitude: number | null;
	longitude: number | null;
	postalCode?: string | null;
}
