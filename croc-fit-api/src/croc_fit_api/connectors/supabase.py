"""Supabase client connector for CrocFit API."""

from functools import lru_cache

from supabase import Client, create_client

from croc_fit_api.settings import get_settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Return an anon Supabase client (read / auth operations)."""
    cfg = get_settings()
    return create_client(cfg.supabase_url, cfg.supabase_anon_key)


@lru_cache(maxsize=1)
def get_supabase_service_client() -> Client:
    """Return a service-role Supabase client (write operations, bypasses RLS)."""
    cfg = get_settings()
    return create_client(cfg.supabase_url, cfg.supabase_service_role_key)
