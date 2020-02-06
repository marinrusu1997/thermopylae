export interface LibAuthEngineConfig {
	jwt: {
		rolesTtl: Map<string, number>; // role -> seconds
	};
	secrets: {
		pepper: string;
		totp: string;
	};
	contacts: {
		adminEmail: string;
	};
}

export interface LibFirewallConfig {
	validationSchemasDir: string;
	excludeDirs: Array<string>;
}

export interface LibGeoIpConfig {
	ipStackAPIKey: string;
}
