"""Mannequin: the blank Bobble kid every costume must fit over. The face has
its details; everything else (head, body, arms, mitts, shoes) is one solid
colour. Same head size and position as every costume."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

BLANK = (0.62, 0.78, 0.92)


def build():
    body(skin=BLANK, shirt=BLANK, pants=BLANK, shoe=BLANK)
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, BLANK, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)


run({"mannequin": build})
