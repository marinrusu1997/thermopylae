const SubjectRoleEncoderDecoder = {
	encode(subject: string, role: string): string {
		return `${subject}@${role}`;
	},
	decode(subject: string): [string, string | undefined] {
		const atPos = subject.indexOf('@');
		if (atPos === -1) {
			return [subject, undefined];
		}
		return [subject.substring(0, atPos), subject.substring(atPos + 1)];
	}
};

export { SubjectRoleEncoderDecoder };
