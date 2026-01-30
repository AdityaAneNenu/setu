#!/usr/bin/env python
"""
Compile .po files to .mo files using polib
"""

import polib
from pathlib import Path

def main():
    base_dir = Path(__file__).resolve().parent
    locale_dir = base_dir / 'locale'
    
    if not locale_dir.exists():
        print(f"Error: Locale directory not found: {locale_dir}")
        return
    
    compiled_count = 0
    
    for lang_dir in locale_dir.iterdir():
        if not lang_dir.is_dir():
            continue
            
        lc_messages = lang_dir / 'LC_MESSAGES'
        if not lc_messages.exists():
            continue
            
        po_file = lc_messages / 'django.po'
        mo_file = lc_messages / 'django.mo'
        
        if po_file.exists():
            try:
                po = polib.pofile(str(po_file))
                po.save_as_mofile(str(mo_file))
                print(f"✓ Compiled {lang_dir.name}: {len(po)} messages ({po_file.name} -> {mo_file.name})")
                compiled_count += 1
            except Exception as e:
                print(f"✗ Error compiling {po_file}: {e}")
    
    if compiled_count > 0:
        print(f"\n✓ Successfully compiled {compiled_count} translation file(s)")
    else:
        print("\n⚠ No translation files were compiled")

if __name__ == '__main__':
    main()
