import { installDeterministicMath } from '@series-inc/rundot-syncplay/core/deterministic-math';

// Browsers differ bitwise on Math.sin, cos, atan2, hypot, and more. The
// simulation uses them for spawn poses and set pieces, so every peer must run
// the same implementation. Import this module first, before any sim module:
// createSyncplayRunner installs the shim too (6.0.0-rc.13), but sim modules
// compute set-piece rotations when they load, before the runner exists.
installDeterministicMath();
