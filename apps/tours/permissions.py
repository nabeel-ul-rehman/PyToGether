from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsTourOwner(BasePermission):
    """Only the tour creator may modify or delete the tour itself."""

    def has_object_permission(self, request, view, obj):
        return obj.created_by_id == request.user.id


class IsTourMemberOrOwner(BasePermission):
    """
    Any member of the tour (creator or joined member) can view it.
    Only the creator can update or delete it.
    """

    def has_object_permission(self, request, view, obj):
        is_member = obj.members.filter(user=request.user).exists()

        if request.method in SAFE_METHODS:
            return is_member

        return obj.created_by_id == request.user.id
