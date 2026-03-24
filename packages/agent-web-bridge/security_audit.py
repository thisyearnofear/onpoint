#!/usr/bin/env python3
"""
Security audit script for agent-web-bridge virtual environment.
Checks for suspicious .pth files and blocked packages.

Run this after any pip install to verify environment integrity.
"""

import os
import sys
from pathlib import Path

def get_venv_site_packages():
    """Get the site-packages directory of the active venv."""
    prefix = sys.prefix
    if sys.platform == 'win32':
        return Path(prefix) / 'Lib' / 'site-packages'
    else:
        # Find the lib/pythonX.Y directory
        lib_dir = Path(prefix) / 'lib'
        for py_dir in lib_dir.iterdir():
            if py_dir.is_dir() and py_dir.name.startswith('python'):
                return py_dir / 'site-packages'
    return None

def check_pth_files(site_packages: Path) -> list:
    """Check for suspicious .pth files."""
    suspicious = []
    allowed_patterns = ['_virtualenv.pth', 'distutils-precedence.pth', 'nspkg.pth', 'pipx_shared.pth']
    
    for pth_file in site_packages.glob('*.pth'):
        # Check for any .pth file that's not in the allowed list
        if not any(pth_file.name.endswith(p) for p in allowed_patterns):
            suspicious.append(str(pth_file))
    
    return suspicious

def check_blocked_packages(site_packages: Path, blocklist_path: Path) -> list:
    """Check if any blocked packages are installed."""
    blocked = []
    
    if not blocklist_path.exists():
        return blocked
    
    with open(blocklist_path, 'r') as f:
        blocked_names = set()
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                blocked_names.add(line.lower())
    
    # Check installed packages
    for dist_info in site_packages.glob('*.dist-info'):
        pkg_name = dist_info.name.split('-')[0].lower().replace('_', '-')
        if pkg_name in blocked_names:
            blocked.append(f"{pkg_name} (found: {dist_info.name})")
    
    return blocked

def check_init_files(site_packages: Path) -> list:
    """Check for suspicious __init__.py files with encoded content."""
    suspicious = []
    
    # Known malicious patterns
    suspicious_files = [
        'litellm_init.pth',
        '_litellm_init.py',
        'litellm_init.py',
    ]
    
    for susp_name in suspicious_files:
        susp_path = site_packages / susp_name
        if susp_path.exists():
            suspicious.append(str(susp_path))
    
    return suspicious

def main():
    print("=" * 60)
    print("Agent-Web-Bridge Security Audit")
    print("=" * 60)
    
    site_packages = get_venv_site_packages()
    if not site_packages:
        print("❌ ERROR: Could not find site-packages directory")
        return 1
    
    print(f"\n📁 Site-packages: {site_packages}")
    
    blocklist_path = Path(__file__).parent / '.pip-blocklist.txt'
    
    issues = []
    
    # Check 1: Suspicious .pth files
    pth_issues = check_pth_files(site_packages)
    if pth_issues:
        issues.extend([f"❌ Suspicious .pth file: {f}" for f in pth_issues])
    else:
        print("✅ No suspicious .pth files found")
    
    # Check 2: Blocked packages
    blocked = check_blocked_packages(site_packages, blocklist_path)
    if blocked:
        issues.extend([f"❌ Blocked package installed: {p}" for p in blocked])
    else:
        print("✅ No blocked packages found")
    
    # Check 3: Known malicious files
    init_issues = check_init_files(site_packages)
    if init_issues:
        issues.extend([f"❌ Malicious file: {f}" for f in init_issues])
    else:
        print("✅ No known malicious files found")
    
    print("\n" + "=" * 60)
    
    if issues:
        print("SECURITY ISSUES FOUND:")
        for issue in issues:
            print(f"  {issue}")
        print("\n⚠️  ACTION REQUIRED: Remove these files/packages immediately!")
        return 1
    else:
        print("✅ All security checks passed!")
        return 0

if __name__ == '__main__':
    sys.exit(main())
