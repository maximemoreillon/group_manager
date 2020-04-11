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
| /top_level_groups | GET | none | Returns the top level groups, i.e. groups that do not belong to any other group |
| /groups_directly_belonging_to_group | GET | id | Returns groups that are directly belonging to that with the provided ID, i.e. no other group in between |

### Querying users
| Endpoint | Method | parameters | Description |
| --- | --- | --- | --- |
| /users_of_group | GET | id | Returns the users belonging to the group with the given ID |
| /administrators_of_group | GET | id | Returns the users that administrate the group with the given ID |
| /users_with_no_group | GET | none | Returns usrs that do not belong to any group |

### Management of group users
| Endpoint | Method | parameters | Description |
| --- | --- | --- | --- |
| /add_user_to_group | POST | user_id, group_id | Adds user whose ID is user_id to the group whose ID is group_id. Only possible if the current user is an administrator of the group |
| /remove_user_from_group | POST | user_id, group_id | Removes user whose ID is user_id from the group whose ID is group_id. Only possible if the current user is an administrator of the group |
| /join_group | POST | group_id | Join group whose ID is group_id. Only possible if the group is not restricted |
| /leave_group | POST | group_id | Leave group whose ID is group_id |

### Management of group administrators
| Endpoint | Method | parameters | Description |
| --- | --- | --- | --- |
| /make_user_administrator_of_group | POST | user_id, group_id | Make user whose ID is user_id an administrator of the group whose ID is group_id. Only possible if the current user is an administrator of the group |
| /remove_user_from_administrators | POST | user_id, group_id | Removes user whose ID is user_id from the administrators of the group whose ID is group_id. Only possible if the current user is an administrator of the group |

