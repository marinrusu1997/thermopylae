-- FIXME we might need to specify the engine when creating tables

-- Table declarations

CREATE TABLE Account (
    ID UNSIGNED INT PRIMARY KEY AUTO_INCREMENT, -- surrogate key
    Enabled BOOLEAN, -- null means it's not enabled
    RelatedCreatorID VARCHAR(20) NOT NULL UNIQUE -- account needs to have a creator; user can create only 1 account
);

CREATE TABLE User (
    ID VARCHAR(20) PRIMARY KEY, -- key with encoded info or random hash
    FirstName VARCHAR(50) NOT NULL, -- each user has a first name
    LastName VARCHAR(50) NOT NULL, -- and last name
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- and it's created at some point in time
    RelatedAccountID UNSIGNED INT, -- null means user is inactive -> doesn't have account -> can't log into system
    RelatedRoleID UNSIGNED TINYINT -- null means it has no role -> no access to global shared resources
);

CREATE TABLE Authentication (
    ID UNSIGNED INT PRIMARY KEY AUTO_INCREMENT, -- surrogate key
    UserName VARCHAR(25) NOT NULL UNIQUE, -- username must be unique
    PasswordHash VARCHAR(250) NOT NULL, -- it's pointless not to have password
    PasswordSalt VARCHAR(10) NOT NULL, -- hashing passwords with salt is mandatory
    MultiFactor BOOLEAN, -- if it's null, it means it doesn't use
    RelatedAccountID UNSIGNED INT NOT NULL UNIQUE, -- authentication is not standalone, it needs to belong to an account;
                                                   -- account can't use multiple authentication in the same time
);

CREATE TABLE UserGroup (
    ID UNSIGNED TINYINT PRIMARY KEY AUTO_INCREMENT, -- surrogate key
    Name VARCHAR(25) NOT NULL UNIQUE, -- each name must be unique
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL -- each group needs to have a creation timestamp
);

CREATE TABLE UserGroupMembers (
    RelatedUserGroupID UNSIGNED TINYINT,
    RelatedUserID VARCHAR(20),

    PRIMARY KEY (RelatedUserGroupID, RelatedUserID) -- unique combinations
);

CREATE TABLE UserGroupPermissions (
    RelatedUserGroupID UNSIGNED TINYINT,
    RelatedPermissionID UNSIGNED SMALLINT,

    PRIMARY KEY (RelatedUserGroupID, RelatedPermissionID) -- unique combinations
);

CREATE TABLE Role (
    ID UNSIGNED TINYINT PRIMARY KEY AUTO_INCREMENT, -- surrogate key
    Name VARCHAR(25) NOT NULL UNIQUE, -- each role name must be unique
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL -- each role needs to have a creation timestamp
);

CREATE TABLE Permission (
    ID UNSIGNED SMALLINT PRIMARY KEY AUTO_INCREMENT,
    Category VARCHAR(50) NOT NULL, -- having it null is pointless
    Resource VARCHAR(50) NOT NULL, -- having it null is pointless
    Operation VARCHAR(50) NOT NULL, -- having it null is pointless

    UNIQUE KEY 'perm_uri' (Category, Resource, Operation) -- each permission is unique
);

CREATE TABLE RolePermissions (
    RelatedRoleID UNSIGNED TINYINT,
    RelatedPermissionID UNSIGNED SMALLINT,

    PRIMARY KEY (RelatedRoleID, RelatedPermissionID) -- unique combinations
);

CREATE TABLE Contact (
    ID UNSIGNED INT PRIMARY KEY AUTO_INCREMENT,
    Class VARCHAR(50) NOT NULL, -- having it null is pointless
    Type VARCHAR(50) NOT NULL, -- having it null is pointless
    Contact VARCHAR(255) NOT NULL, -- having it null is pointless
    RelatedUserID VARCHAR(20) NOT NULL, -- having it without user is pointless

    UNIQUE KEY 'contact_uri' (Class, Type, RelatedUserID) -- user can have only 1 type of contact from a certain class
);

CREATE TABLE FailedAuthenticationAttempt (
    ID UNSIGNED INT PRIMARY KEY AUTO_INCREMENT,
    DetectedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, -- obviously it has a detection timestamp
    Ip VARCHAR(45) NOT NULL, -- failed auth attempt needs to take place from a ip; IPv6 max length
    RelatedDeviceID VARCHAR(20) NOT NULL, -- failed auth attempt needs to take place from a device
    RelatedAuthenticationID UNSIGNED INT NOT NULL -- obviously it needs to be associated with an authentication
);

CREATE TABLE Device (
    ID VARCHAR(20) PRIMARY KEY, -- SHA-1 of the Source
    OperatingSystem VARCHAR(50),
    Platform VARCHAR(50),
    Browser VARCHAR(50),
    Version VARCHAR(50),
    Source VARCHAR(300)
);

CREATE TABLE UserSession (
   CreatedAtUNIXTimestamp UNSIGNED INT,
   RelatedUserID VARCHAR(20),
   Ip VARCHAR(45) NOT NULL, -- session needs to be established from an ip; IPv6 max length
   IsActive BOOLEAN, -- if it's null, it means it's not active
   RelatedDeviceID VARCHAR(20) NOT NULL, -- session needs to be established from a device
   RelatedLocationID VARCHAR(20) NOT NULL -- session needs to be established from a location

   PRIMARY KEY (CreatedAtUNIXTimestamp, RelatedUserID) -- user can have multiple sessions, so we identify them also with creation timestamp
);

CREATE TABLE Location (
   ID VARCHAR(20) PRIMARY KEY, -- SHA-1 of all the columns
   CountryCode VARCHAR(3),
   RegionCode VARCHAR(5),
   City VARCHAR(30),
   TimeZone VARCHAR(100),
   Latitude INT,
   Longitude INT,
   PostalCode VARCHAR(16)
);

-- Foreign Key definitions
ALTER TABLE User
ADD CONSTRAINT FK_Account
FOREIGN KEY (RelatedAccountID) REFERENCES Account(ID)
ON DELETE CASCADE;

ALTER TABLE User
ADD CONSTRAINT FK_Role
FOREIGN KEY (RelatedRoleID) REFERENCES Role(ID)
ON DELETE SET NULL;

ALTER TABLE Authentication
ADD CONSTRAINT FK_Account
FOREIGN KEY (RelatedAccountID) REFERENCES Account(ID)
ON DELETE CASCADE; -- when account is deleted, it's authentication is deleted too -> in cascade will trigger deletion of failed auth attempts

ALTER TABLE Account
ADD CONSTRAINT FK_UserCreator
FOREIGN KEY (RelatedCreatorID) REFERENCES User(ID)
ON DELETE CASCADE; -- creator has the ownership of the account, if owner is deleted, it's account, along with the users which use it, are deleted

ALTER TABLE UserGroupPermissions
ADD CONSTRAINT FK_UserGroup
FOREIGN KEY (RelatedUserGroupID) REFERENCES UserGroup(ID)
ON DELETE CASCADE; -- when user group is deleted, all it's permissions must be deleted too

ALTER TABLE UserGroupPermissions
ADD CONSTRAINT FK_Permissions
FOREIGN KEY (RelatedPermissionsID) REFERENCES Permission(ID)
ON DELETE CASCADE; -- when permission is deleted, user group loses this permission

ALTER TABLE UserGroupMembers
ADD CONSTRAINT FK_UserGroup
FOREIGN KEY (RelatedUserGroupID) REFERENCES UserGroup(ID)
ON DELETE CASCADE; -- when user group is delete, all it's members are also deleted

ALTER TABLE UserGroupMembers
ADD CONSTRAINT FK_UserMember
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, it must be removed from all groups where it takes part

ALTER TABLE RolePermissions
ADD CONSTRAINT FK_Role
FOREIGN KEY (RelatedRoleID) REFERENCES Role(ID)
ON DELETE CASCADE; -- when role is deleted, all it's permissions must be deleted too

ALTER TABLE RolePermissions
ADD CONSTRAINT FK_Permission
FOREIGN KEY (RelatedPermissionID) REFERENCES Permission(ID)
ON DELETE CASCADE; -- when permission is deleted, role's permission must be deleted too

ALTER TABLE Contact
ADD CONSTRAINT FK_User
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, all it's contacts must be deleted too

ALTER TABLE FailedAuthenticationAttempt
ADD CONSTRAINT FK_Device
FOREIGN KEY (RelatedDeviceID) REFERENCES Device(ID)
ON DELETE RESTRICT; -- failed auth attempt is precious data, Device can be deleted only if there are not failed auth attempts

ALTER TABLE FailedAuthenticationAttempt
ADD CONSTRAINT FK_Authentication
FOREIGN KEY (RelatedAuthenticationID) REFERENCES Authentication(ID)
ON DELETE CASCADE; -- when authentication is deleted, all it's failed attempts must be deleted too

ALTER TABLE UserSession
ADD CONSTRAINT FK_User
FOREIGN KEY (RelatedUserID) REFERENCES User(ID)
ON DELETE CASCADE; -- when user is deleted, all user sessions must be deleted too, and existing ones invalidated

ALTER TABLE UserSession
ADD CONSTRAINT FK_Device
FOREIGN KEY (RelatedDeviceID) REFERENCES Device(ID)
ON DELETE RESTRICT; -- device can't be deleted while there are existing session from that one

ALTER TABLE UserSession
ADD CONSTRAINT FK_Location
FOREIGN KEY (RelatedLocationID) REFERENCES Location(ID)
ON DELETE RESTRICT; -- location can't be deleted while there are existing session from that one
