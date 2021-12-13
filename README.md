# Group manager

[![pipeline status](https://gitlab.com/moreillon_k8s/group-manager/group_manager_neo4j/badges/master/pipeline.svg)](https://gitlab.com/moreillon_k8s/group-manager/group_manager_neo4j)
[![coverage report](https://gitlab.com/moreillon_k8s/group-manager/group_manager_neo4j/badges/master/coverage.svg)](https://gitlab.com/moreillon_k8s/group-manager/group_manager_neo4j)

A NodeJS application to manage groups of users.
The user and group information is stored in a Neo4J database.

## API endpoints
### Groups
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /v2/groups/ | GET | tbd | Returns list of groups |
| /v3/groups/ | GET | tbd | Returns list of groups |
| /v2/groups/{group_id} | GET | - | Returns information about the group corresponding to the provided ID |
| /v2/groups/{group_id} | PATCH | properties | Updates properties of a group |
| /v2/groups/{group_id} | DELETE | - | Deletes a group |
| /v2/groups/{group_id}/join | POST | - | Join a group |
| /v2/groups/{group_id}/leave | POST | - | leave a group |


### Subgroups
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /v2/groups/{group_id}/groups | GET | - | Returns the groups belonging to the group with the given ID |
| /v2/groups/{group_id}/groups/direct | GET | - | Returns the groups directly belonging to the group with the given ID |
| /v2/groups/{group_id}/parent_groups | GET | - | Returns the groups to which the group with the given ID belongs |
| /v2/groups/{group_id}/groups/{subgroup_id} | POST | - | Puts a group into another |
| /v2/groups/{group_id}/groups/{subgroup_id} | DELETE | - | Removes a subgroup from a group |

### Members
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /v2/groups/none/members | GET | - | Returns users without a group |
| /v2/groups/{group_id}/members | GET | - | Returns the users belonging to the group with the given ID |
| /v2/groups/{group_id}/members/{user_id} | POST | - | Adds a user to the group |
| /v2/groups/{group_id}/members/{user_id} | DELETE | - | Removes a user from the group |
| /v2/members/{member_id}/groups | GET | - | Gets the groups of a member, here, use 'self' as member_id of one's own groups |


### Administrators
| Endpoint | Method | query/body | Description |
| --- | --- | --- | --- |
| /v2/groups/{group_id}/administrators | GET | - | Returns the administrators of the group with the given ID |
| /v2/groups/{group_id}/administrators/{administrator_id} | POST | - | Adds an administrator to the group |
| /v2/groups/{group_id}/administrators/{administrator_id} | DELETE | - | Removes an administrator from the group |
| /v2/administrators/{administrators_id}/groups | GET | - | Gets the groups administrated by a user, here, use 'self' as member_id of one's own groups |
