interface Transaction {
	transactionType: string;
	amount: string;
	currencySymbol: string;
}

interface Address {
	countryCode: string;
	city: string;
}

interface Finance {
	bank: {
		name: string;
	};
	transactions: Array<Transaction>;
}

interface Person {
	id: string;
	firstName: string;
	birthYear: number;
	address: Address;
	finance: Finance;
	visitedCountries: Array<string>;
}

export type { Transaction, Address, Finance, Person };
