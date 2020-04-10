-- FIXME we might need to specify the engine when creating tables

-- Table declarations

CREATE TABLE IF NOT EXISTS Account (
    ID VARCHAR(20), -- the same key as of the user which created this account
    Enabled BOOLEAN, -- null means it's not enabled

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS User (
    ID VARCHAR(20), -- key with encoded info or random hash
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- it's created at some point in time
    RelatedAccountID VARCHAR(20), -- for the user who created the account it's the same as the user id
                                  -- null means user is inactive -> doesn't have account -> can't log into system
    RelatedRoleID TINYINT UNSIGNED, -- null means it has no role -> no access to global shared resources

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS UserDetails (
    ID INT UNSIGNED AUTO_INCREMENT,
    FirstName VARCHAR(50) NOT NULL, -- each user has a first name
    LastName VARCHAR(50) NOT NULL, -- and last name
    Birthday DATE NOT NULL,
    RelatedUserID VARCHAR(20),

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS Authentication (
    ID VARCHAR(20), -- the same key as the account who it belongs to
    UserName VARCHAR(25) NOT NULL UNIQUE, -- username must be unique
    PasswordHash VARCHAR(250) NOT NULL, -- it's pointless not to have password
    PasswordSalt VARCHAR(30) NOT NULL, -- hashing passwords with salt is mandatory
    PasswordHashingAlg TINYINT(3) NOT NULL,
    MultiFactor BOOLEAN, -- if it's null, it means it doesn't use
    UpdatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS FailedAuthenticationAttempt (
    ID INT UNSIGNED AUTO_INCREMENT,
    DetectedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- obviously it has a detection timestamp
    Ip VARCHAR(45) NOT NULL, -- failed auth attempt needs to take place from a ip; IPv6 max length
    RelatedDeviceID VARCHAR(20) NOT NULL, -- failed auth attempt needs to take place from a device
    RelatedAuthenticationID VARCHAR(20) NOT NULL, -- obviously it needs to be associated with an authentication

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS Contact (
    ID INT UNSIGNED AUTO_INCREMENT,
    Class VARCHAR(50) NOT NULL, -- having it null is pointless
    Type VARCHAR(50) NOT NULL, -- having it null is pointless
    Contact VARCHAR(255) NOT NULL, -- having it null is pointless
    RelatedUserID VARCHAR(20) NOT NULL, -- having it without user is pointless

    PRIMARY KEY (ID),
    UNIQUE KEY `UK_ContactURI` (Class, Type, RelatedUserID) -- user can have only 1 type of contact from a certain class
);

CREATE TABLE IF NOT EXISTS Device (
    ID VARCHAR(20), -- SHA-1 of the Source
    OperatingSystem VARCHAR(50),
    Platform VARCHAR(50),
    Browser VARCHAR(50),
    Version VARCHAR(50),
    Source VARCHAR(300),

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS UserSession (
   CreatedAtUNIXTimestamp INT UNSIGNED,
   RelatedUserID VARCHAR(20),
   Ip VARCHAR(45) NOT NULL, -- session needs to be established from an ip; IPv6 max length
   IsActive BOOLEAN, -- if it's null, it means it's not active
   RelatedDeviceID VARCHAR(20) NOT NULL, -- session needs to be established from a device
   RelatedLocationID VARCHAR(20) NOT NULL, -- session needs to be established from a location

   PRIMARY KEY (CreatedAtUNIXTimestamp, RelatedUserID) -- user can have multiple sessions, so we identify them also with creation timestamp
);

CREATE TABLE IF NOT EXISTS Location (
   ID VARCHAR(20), -- SHA-1 of all the columns
   CountryCode VARCHAR(3),
   RegionCode VARCHAR(5),
   City VARCHAR(30),
   TimeZone VARCHAR(100),
   Latitude INT,
   Longitude INT,
   PostalCode VARCHAR(16),

   PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS UserGroup (
    ID TINYINT UNSIGNED AUTO_INCREMENT, -- surrogate key
    Name VARCHAR(25) NOT NULL UNIQUE, -- each name must be unique
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- each group needs to have a creation timestamp

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS UserGroupMembers (
    RelatedUserGroupID TINYINT UNSIGNED,
    RelatedUserID VARCHAR(20),

    PRIMARY KEY (RelatedUserGroupID, RelatedUserID) -- unique combinations
);

CREATE TABLE IF NOT EXISTS UserGroupPermissions (
    RelatedUserGroupID TINYINT UNSIGNED,
    RelatedPermissionID SMALLINT UNSIGNED,

    PRIMARY KEY (RelatedUserGroupID, RelatedPermissionID) -- unique combinations
);

CREATE TABLE IF NOT EXISTS Role (
    ID TINYINT UNSIGNED AUTO_INCREMENT, -- surrogate key
    Name VARCHAR(25) NOT NULL UNIQUE, -- each role name must be unique
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- each role needs to have a creation timestamp

    PRIMARY KEY (ID)
);

CREATE TABLE IF NOT EXISTS Permission (
    ID SMALLINT UNSIGNED AUTO_INCREMENT,
    Category VARCHAR(50) NOT NULL, -- having it null is pointless
    Resource VARCHAR(50) NOT NULL, -- having it null is pointless
    Operation VARCHAR(50) NOT NULL, -- having it null is pointless

    PRIMARY KEY (ID),
    UNIQUE KEY `UK_PermURI` (Category, Resource, Operation) -- each permission is unique
);

CREATE TABLE IF NOT EXISTS RolePermissions (
    RelatedRoleID TINYINT UNSIGNED,
    RelatedPermissionID SMALLINT UNSIGNED,

    PRIMARY KEY (RelatedRoleID, RelatedPermissionID) -- unique combinations
);

-- Foreign Key definitions

ALTER TABLE Account
ADD CONSTRAINT
FOREIGN KEY (ID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user who owns this account is deleted, it's account must be deleted too

ALTER TABLE User
ADD CONSTRAINT
FOREIGN KEY (RelatedAccountID) REFERENCES Account(ID)
ON DELETE CASCADE; -- although user without account can exist, in order to not leak resources, when account is deleted, users are deleted too

ALTER TABLE User
ADD CONSTRAINT
FOREIGN KEY (RelatedRoleID) REFERENCES Role(ID)
ON DELETE SET NULL; -- user without role is a legal state, so we set null

ALTER TABLE UserDetails
ADD CONSTRAINT
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, it's details are deleted too

ALTER TABLE Authentication
ADD CONSTRAINT
FOREIGN KEY (ID) REFERENCES Account(ID)
ON DELETE CASCADE; -- when account is deleted, it's authentication is deleted too -> in cascade will trigger deletion of failed auth attempts

ALTER TABLE UserGroupPermissions
ADD CONSTRAINT
FOREIGN KEY (RelatedUserGroupID) REFERENCES UserGroup(ID)
ON DELETE CASCADE; -- when user group is deleted, all it's permissions must be deleted too

ALTER TABLE UserGroupPermissions
ADD CONSTRAINT
FOREIGN KEY (RelatedPermissionID) REFERENCES Permission(ID)
ON DELETE CASCADE; -- when permission is deleted, user group loses this permission

ALTER TABLE UserGroupMembers
ADD CONSTRAINT
FOREIGN KEY (RelatedUserGroupID) REFERENCES UserGroup(ID)
ON DELETE CASCADE; -- when user group is delete, all it's members are also deleted

ALTER TABLE UserGroupMembers
ADD CONSTRAINT
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, it must be removed from all groups where it takes part

ALTER TABLE RolePermissions
ADD CONSTRAINT
FOREIGN KEY (RelatedRoleID) REFERENCES Role(ID)
ON DELETE CASCADE; -- when role is deleted, all it's permissions must be deleted too

ALTER TABLE RolePermissions
ADD CONSTRAINT
FOREIGN KEY (RelatedPermissionID) REFERENCES Permission(ID)
ON DELETE CASCADE; -- when permission is deleted, role's permission must be deleted too

ALTER TABLE Contact
ADD CONSTRAINT
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, all it's contacts must be deleted too

ALTER TABLE FailedAuthenticationAttempt
ADD CONSTRAINT
FOREIGN KEY (RelatedDeviceID) REFERENCES Device(ID)
ON DELETE RESTRICT; -- failed auth attempt is precious data, Device can be deleted only if there are not failed auth attempts

ALTER TABLE FailedAuthenticationAttempt
ADD CONSTRAINT
FOREIGN KEY (RelatedAuthenticationID) REFERENCES Authentication(ID)
ON DELETE CASCADE; -- when authentication is deleted, all it's failed attempts must be deleted too

ALTER TABLE UserSession
ADD CONSTRAINT
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, all user sessions must be deleted too, and existing ones invalidated

ALTER TABLE UserSession
ADD CONSTRAINT
FOREIGN KEY (RelatedDeviceID) REFERENCES Device(ID)
ON DELETE RESTRICT; -- device can't be deleted while there are existing session from that one

ALTER TABLE UserSession
ADD CONSTRAINT
FOREIGN KEY (RelatedLocationID) REFERENCES Location(ID)
ON DELETE RESTRICT; -- location can't be deleted while there are existing session from that one
