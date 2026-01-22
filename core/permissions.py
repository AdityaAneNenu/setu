from functools import wraps


class Role:
    GROUND = "ground"
    MANAGER = "manager"
    AUTHORITY = "authority"
    ADMIN = "admin"

    ALL = [GROUND, MANAGER, AUTHORITY, ADMIN]


def get_user_role(user):
    """Resolve a user's role with sane fallbacks."""
    if not user.is_authenticated:
        return None

    # Treat superusers/staff as admin-level
    if user.is_superuser or user.is_staff:
        return Role.ADMIN

    profile = getattr(user, "profile", None)
    if profile and profile.role:
        return profile.role

    # Default to ground if nothing set
    return Role.GROUND


def role_required(allowed_roles):
    """
    Decorator to enforce role-based access on views.

    - Admin (superuser/staff) bypasses checks.
    - Users without an assigned role default to ground.
    """

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            role = get_user_role(request.user)

            if request.user.is_superuser or request.user.is_staff:
                return view_func(request, *args, **kwargs)

            if role in allowed_roles:
                return view_func(request, *args, **kwargs)

            from django.http import HttpResponseForbidden

            return HttpResponseForbidden(
                "You do not have permission to access this page."
            )

        return _wrapped_view

    return decorator


def can_resolve_gaps(user):
    """Check if user has authority to mark gaps as resolved (AUTHORITY or ADMIN only)"""
    role = get_user_role(user)
    return role in [Role.AUTHORITY, Role.ADMIN]


def can_verify_gaps(user):
    """Check if user can verify/assign gaps (MANAGER and above)"""
    role = get_user_role(user)
    return role in [Role.MANAGER, Role.AUTHORITY, Role.ADMIN]


def can_create_gaps(user):
    """Check if user can create gaps (all authenticated users)"""
    return user.is_authenticated
