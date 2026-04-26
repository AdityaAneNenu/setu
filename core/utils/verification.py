import math


def haversine_m(lat1, lng1, lat2, lng2):
    """Distance in meters between two latitude/longitude points."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def average_hash_64(image):
    """Return a lightweight 64-bit average hash for an image."""
    img = image.convert("L").resize((8, 8))
    pixels = list(img.getdata())
    avg = sum(pixels) / 64.0
    bits = 0
    for idx, px in enumerate(pixels):
        if px >= avg:
            bits |= 1 << idx
    return bits


def hamming_distance_64(a, b):
    return (a ^ b).bit_count()


def hash_image_file(file_obj):
    """Open and hash image files safely with bounded decode size."""
    from PIL import Image, ImageFile

    ImageFile.LOAD_TRUNCATED_IMAGES = True
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    with Image.open(file_obj) as img:
        converted_img = img.convert("RGB")
        converted_img.thumbnail((1024, 1024))
        hashed = average_hash_64(converted_img)
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    return hashed
