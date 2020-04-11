# Group manager
A NodeJS application to manage groups of users

## API endpoints:

| Endpoint | Method | parameters | Description |
| --- | --- | --- | --- |
| /group | GET | id | Returns information about the group corresponding to the provided ID |
| /group_by_id | GET | id | Alias of /group |

| /groups_of_user | GET | id | Returns the groups that the user with the given ID is belonging to |
| /groups_of_administrator | GET | id | Returns the groups that the user with the given ID is administrating |

| /users_of_group | GET | id | Returns the users belonging to the group with the given ID |
| /groups_of_group | GET | id | Returns the groups belonging to the group with the given ID |
| /administrators_of_group | GET | id | Returns the users that administrate the group with the given ID |
