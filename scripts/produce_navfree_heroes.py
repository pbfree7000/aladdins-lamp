#!/usr/bin/env python3
"""Compatibility entrypoint: previous vertical remap algorithm was destructive.

Retouch baked navigation only using the undistorted original files.
"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().with_name("restore_unwarped_heroes.py")), run_name="__main__")
