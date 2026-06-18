import httpx
import json

try:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    # 1. Get access token
    res = httpx.get("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", headers=headers, timeout=10)
    print("Token status:", res.status_code)
    token_data = res.json()
    token = token_data.get("accessToken")
    print("Token:", token[:20] + "...")
    
    # 2. Search Spotify
    auth_headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": headers["User-Agent"]
    }
    res_search = httpx.get("https://api.spotify.com/v1/search?type=track&q=TV%20Girl&limit=8", headers=auth_headers, timeout=10)
    print("Search status:", res_search.status_code)
    data = res_search.json()
    tracks = data.get("tracks", {}).get("items", [])
    print("Found tracks:", len(tracks))
    for t in tracks[:5]:
        print(f" - {t.get('name')} by {t.get('artists')[0].get('name')} (URL: {t.get('external_urls').get('spotify')})")
except Exception as e:
    print("Error:", e)
