-- Tables definitions
-- @fixme think better on this model

CREATE TABLE IF NOT EXISTS Account (
    id INT UNSIGNED AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    passwordHash VARCHAR(250) NOT NULL,
    passwordSalt VARCHAR(30),
    passwordAlg TINYINT(1) NOT NULL,
    email VARCHAR(256) NOT NULL UNIQUE,
    telephone VARCHAR(16) UNIQUE,
    disabledUntil INT NOT NULL,
    mfa BOOLEAN NOT NULL,
    totpSecret VARCHAR(50),
    pubKey VARCHAR(255),

    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS SuccessfulAuthentication (
    id INT UNSIGNED AUTO_INCREMENT,
    accountId INT UNSIGNED NOT NULL,
    ip VARCHAR(45) NOT NULL,
    deviceId VARCHAR(50),
    location VARCHAR(250),
    authenticatedAt INT NOT NULL,

    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS FailedAuthentication (
    id INT UNSIGNED AUTO_INCREMENT,
    accountId INT UNSIGNED NOT NULL,
    ip VARCHAR(45) NOT NULL,
    deviceId VARCHAR(50),
    location VARCHAR(250),
    detectedAt INT NOT NULL,

    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS AuthenticationDevice (
    id VARCHAR(50),
    json VARCHAR(250) NOT NULL,

    PRIMARY KEY (id)
);

-- Foreign Key definitions

ALTER TABLE SuccessfulAuthentication
ADD CONSTRAINT
FOREIGN KEY (accountId) REFERENCES Account(id)
ON DELETE CASCADE; -- when user who owns this authentication is deleted, it's account must be deleted too

ALTER TABLE SuccessfulAuthentication
ADD CONSTRAINT
FOREIGN KEY (deviceId) REFERENCES AuthenticationDevice(id);

ALTER TABLE FailedAuthentication
ADD CONSTRAINT
FOREIGN KEY (accountId) REFERENCES Account(id)
ON DELETE CASCADE; -- when user who owns this authentication is deleted, it's account must be deleted too

ALTER TABLE FailedAuthentication
ADD CONSTRAINT
FOREIGN KEY (deviceId) REFERENCES AuthenticationDevice(id);
