// Shared helpers for the course files.
/**
 * A kicker ramp: a short steep slope that throws the ball, open at both ends
 * of its run so it launches off the top. `dir` is the way it throws (e/w/s/n).
 */
export const kick = (x0, z0, x1, z1, dir, y0 = 0, g = 0.45) => {
    const alongX = dir === 'e' || dir === 'w', s = dir === 'e' || dir === 's' ? 1 : -1, len = alongX ? x1 - x0 : z1 - z0;
    return { r: [x0, z0, x1, z1], y: y0 + g * len / 2, slope: alongX ? [g * s, 0] : [0, g * s], kind: 'wood', open: alongX ? 'we' : 'ns', kick: true };
};

