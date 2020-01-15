export interface BasicCredentials {
	username: string;
	password: string;
}

export interface BasicLocation {
	countryCode: string;
	regionCode: string;
	city: string;
	timeZone: string | object;
	latitude: number;
	longitude: number;
	postalCode?: string;
}
