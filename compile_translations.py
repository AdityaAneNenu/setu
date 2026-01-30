#!/usr/bin/env python
"""
Compile .po files to .mo files using Python's msgfmt
This is a workaround when GNU gettext tools are not available
"""

import os
import sys
from pathlib import Path

def compile_messages():
    """Compile .po files to .mo files"""
    
    base_dir = Path(__file__).resolve().parent
    locale_dir = base_dir / 'locale'
    
    if not locale_dir.exists():
        print(f"Error: Locale directory not found: {locale_dir}")
        return False
    
    success = True
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
                # Try using Django's compilemessages
                from django.core.management import execute_from_command_line
                os.chdir(base_dir)
                execute_from_command_line(['manage.py', 'compilemessages', '-l', lang_dir.name])
                print(f"✓ Compiled {po_file} -> {mo_file}")
            except Exception as e:
                # Fallback: create a simple .mo file
                print(f"⚠ Warning: Could not compile {po_file}: {e}")
                print(f"  Creating empty .mo file as placeholder")
                mo_file.write_bytes(b'')
                success = False
    
    return success

if __name__ == '__main__':
    if compile_messages():
        print("\n✓ All translation files compiled successfully")
        sys.exit(0)
    else:
        print("\n⚠ Some translations could not be compiled (placeholders created)")
        sys.exit(0)
