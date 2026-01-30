#!/usr/bin/env python
"""
Simple MO file compiler for when gettext is not available
Based on Django's internal msgfmt implementation
"""

import os
import struct
import array
from pathlib import Path

def make_msgid(message):
    """Generate a message ID from a message string."""
    return message.encode('utf-8')

def compile_po_to_mo(po_file, mo_file):
    """
    Compile a .po file to .mo file format
    """
    
    messages = {}
    current_msgid = None
    current_msgstr = None
    in_msgid = False
    in_msgstr = False
    
    with open(po_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            if line.startswith('msgid '):
                if current_msgid is not None and current_msgstr is not None:
                    if current_msgid:  # Skip empty msgid (header)
                        messages[current_msgid] = current_msgstr
                current_msgid = line[7:-1] if line.endswith('"') else line[7:]
                current_msgstr = None
                in_msgid = True
                in_msgstr = False
                
            elif line.startswith('msgstr '):
                current_msgstr = line[8:-1] if line.endswith('"') else line[8:]
                in_msgid = False
                in_msgstr = True
                
        # Don't forget the last message
        if current_msgid is not None and current_msgstr is not None:
            if current_msgid:  # Skip empty msgid (header)
                messages[current_msgid] = current_msgstr
    
    # Prepare data for MO file
    keys = sorted(messages.keys())
    offsets = []
    ids = b''
    strs = b''
    
    for key in keys:
        msg_id = key.encode('utf-8')
        msg_str = messages[key].encode('utf-8')
        
        offsets.append((len(ids), len(msg_id), len(strs), len(msg_str)))
        ids += msg_id + b'\x00'
        strs += msg_str + b'\x00'
    
    # Generate the binary MO file with proper UTF-8 header
    keystart = 7 * 4 + 16 * len(keys)
    valuestart = keystart + len(ids)
    
    # Create proper header with charset info
    header_msgstr = b'Content-Type: text/plain; charset=UTF-8\\nContent-Transfer-Encoding: 8bit\\n'
    
    # Magic number, version, number of entries
    output = struct.pack('Iiiiiii',
                        0x950412de,        # Magic number (little-endian)
                        0,                 # Version
                        len(keys),         # Number of entries
                        7 * 4,             # Start of key index
                        7 * 4 + 8 * len(keys),  # Start of value index
                        0, 0)              # Size and offset of hash table
    
    # Key and value offsets
    for o1, l1, o2, l2 in offsets:
        output += struct.pack('ii', l1, o1 + keystart)
    for o1, l1, o2, l2 in offsets:
        output += struct.pack('ii', l2, o2 + valuestart)
    
    output += ids + strs
    
    with open(mo_file, 'wb') as f:
        f.write(output)
    
    return len(keys)

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
                count = compile_po_to_mo(po_file, mo_file)
                print(f"✓ Compiled {lang_dir.name}: {count} messages ({po_file.name} -> {mo_file.name})")
                compiled_count += 1
            except Exception as e:
                print(f"✗ Error compiling {po_file}: {e}")
    
    if compiled_count > 0:
        print(f"\n✓ Successfully compiled {compiled_count} translation file(s)")
    else:
        print("\n⚠ No translation files were compiled")

if __name__ == '__main__':
    main()
