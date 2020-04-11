# Group manager
A NodeJS application to manage groups of users

## API endpoints

### Querying groups
| Endpoint | Method | parameters | Description |
| --- | --- | --- | --- |
| /group | GET | id | Returns information about the group corresponding to the provided ID |
| /group_by_id | GET | id | Alias of /group |
| /groups_of_user | GET | id | Returns the groups that the user with the given ID is belonging to |
| /groups_of_administrator | GET | id | Returns the groups that the user with the given ID is administrating |
| /groups_of_group | GET | id | Returns the groups belonging to the group with the given ID |
| /top_level_groups | GET |  | Returns the top level groups, i.e. groups that do not belong to any other group |
| /groups_directly_belonging_to_group | GET |  | Returns groups that are directly belonging to that with the provided ID, i.e. no other group in between |

### Querying users
| Endpoint | Method | parameters | Description |
| --- | --- | --- | --- |
| /users_of_group | GET | id | Returns the users belonging to the group with the given ID |
| /administrators_of_group | GET | id | Returns the users that administrate the group with the given ID |
| /users_with_no_group | GET |  | Returns usrs that do not belong to any group |
