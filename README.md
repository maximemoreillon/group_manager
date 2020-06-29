# Group manager
A NodeJS application to manage groups of users

## API endpoints
### Groups
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /groups/top_level | GET | none | Returns the top level groups, i.e. groups that do not belong to any other group |
| /groups/top_level/official | GET | none | Returns the official top level groups |
| /groups/top_level/non_official | GET | none | Returns the non-official top level groups |
| /groups/{group_id} | GET | - | Returns information about the group corresponding to the provided ID |
| /groups/{group_id} | PATCH | properties | Updates properties of a group |
| /groups/{group_id} | DELETE | - | Deletes a group |
| /groups/{group_id}/join | POST | - | Join a group |
| /groups/{group_id}/leave | POST | - | leave a group |


### Subgroups
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /groups/{group_id}/groups | GET | - | Returns the groups belonging to the group with the given ID |
| /groups/{group_id}/groups/direct | GET | - | Returns the groups directly belonging to the group with the given ID |
| /groups/{group_id}/parent_groups | GET | - | Returns the groups to which the group with the given ID belongs |
| /groups/{group_id}/groups/{subgroup_id} | POST | - | Puts a group into another |
| /groups/{group_id}/groups/{subgroup_id} | DELETE | - | Removes a subgroup from a group |

### Members
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /groups/none/members | GET | - | Returns users without a group |
| /groups/{group_id}/members | GET | - | Returns the users belonging to the group with the given ID |
| /groups/{group_id}/members/{user_id} | POST | - | Adds a user to the group |
| /groups/{group_id}/members/{user_id} | DELETE | - | Removes a user from the group |
| /members/{member_id}/groups | GET | - | Gets the groups of a member, here, use 'self' as member_id of one's own groups |


### Administrators
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /groups/{group_id}/administrators | GET | - | Returns the administrators of the group with the given ID |
| /groups/{group_id}/administrators/{administrator_id} | POST | - | Adds an administrator to the group |
| /groups/{group_id}/administrators/{administrator_id} | DELETE | - | Removes an administrator from the group |
| /administrators/{administrators_id}/groups | GET | - | Gets the groups administrated by a user, here, use 'self' as member_id of one's own groups |
