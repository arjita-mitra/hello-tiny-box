const radians = thetaDegrees => (thetaDegrees * Math.PI) / 180
const getSinCos = theta => [Math.sin(radians(theta)), Math.cos(radians(theta))]

const uniformMatrix4x4 = d => {
    const dRow = [d, d, d, d]
    return [dRow.slice(), dRow.slice(), dRow.slice(), dRow.slice()]
}

const multiply4x4 = (matrixA, matrixB) => {
    let resultMatrix = uniformMatrix4x4(null)

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            resultMatrix[i][j] =
                matrixA[i][0] * matrixB[0][j] +
                matrixA[i][1] * matrixB[1][j] +
                matrixA[i][2] * matrixB[2][j] +
                matrixA[i][3] * matrixB[3][j]
        }
    }

    return resultMatrix
}

function rotX(theta, tx = 0, ty = 0, tz = 0) {
    const [s, c] = getSinCos(theta)

    return [
        [1, 0, 0, tx],
        [0, c, -s, ty],
        [0, s, c, tz],
        [0, 0, 0, 1],
    ]
}

function rotY(theta) {
    const [s, c] = getSinCos(theta)
    return [
        [c, 0, s, 0],
        [0, 1, 0, 0],
        [-s, 0, c, 0],
        [0, 0, 0, 1],
    ]
}

function rotZ(theta) {
    const [s, c] = getSinCos(theta)
    return [
        [c, -s, 0, 0],
        [s, c, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ]
}

const rotXYZ = eulerVec => {
    const rx = rotX(eulerVec.x)
    const ry = rotY(eulerVec.y)
    const rz = rotZ(eulerVec.z)
    const rxy = multiply4x4(rx, ry)
    const rxyz = multiply4x4(rxy, rz)
    return rxyz
}

class Vector {
    constructor(x, y, z, name) {
        this.x = x
        this.y = y
        this.z = z
        this.name = name
    }

    getTransformedPoint(transformMatrix) {
        const [r0, r1, r2] = transformMatrix.slice(0, 3)
        const [r00, r01, r02, tx] = r0
        const [r10, r11, r12, ty] = r1
        const [r20, r21, r22, tz] = r2

        const newX = this.x * r00 + this.y * r01 + this.z * r02 + tx
        const newY = this.x * r10 + this.y * r11 + this.z * r12 + ty
        const newZ = this.x * r20 + this.y * r21 + this.z * r22 + tz
        return new Vector(newX, newY, newZ, this.name)
    }
}

const tMatrix = translation => [
    [1, 0, 0, translation.x],
    [0, 1, 0, translation.y],
    [0, 0, 1, translation.z],
    [0, 0, 0, 1],
]

const sMatrix = s => [
    [s.x, 0, 0, 0],
    [0, s.y, 0, 0],
    [0, 0, s.z, 0],
    [0, 0, 0, 1],
]

/*
   E4------F5      y
   |`.    | `.     |
   |  `A0-----B1   *----- x
   |   |  |   |     \
   G6--|--H7  |      \
    `. |   `. |       z
      `C2-----D3
*/
class NormalUnitCube {
    CENTER = new Vector(0, 0, 0, "cube-center") // cube-center
    POINTS = [
        new Vector(-1, +1, +1, "front-top-left"), // A0
        new Vector(+1, +1, +1, "front-top-right"), // B1
        new Vector(-1, -1, +1, "front-bottom-left"), // C2
        new Vector(+1, -1, +1, "front-bottom-right"), // D3
        new Vector(-1, +1, -1, "back-top-left"), // E4
        new Vector(+1, +1, -1, "back-top-right"), // F5
        new Vector(-1, -1, -1, "back-bottom-left"), // G6
        new Vector(+1, -1, -1, "back-bottom-right"), // H7
    ]
}

class Cube {
    UNIT_CUBE = new NormalUnitCube()
    constructor(
        eulerVec = new Vector(0, 0, 0),
        scale = new Vector(1, 1, 1),
        translateVec = new Vector(0, 0, 0)
    ) {
        const rMatrix = rotXYZ(eulerVec)
        const s = scale
        const t = translateVec
        this.wrtWorldMatrix = multiply4x4(tMatrix(t), multiply4x4(sMatrix(s), rMatrix))
        this.points = this.UNIT_CUBE.POINTS
    }
}

const getWorldWrtCameraMatrix = (
    translateVec = Vector(0, 0, 0),
    eulerVec = Vector(0, 0, 0)
) => {
    const r = rotXYZ(eulerVec)
    const t = translateVec
    // Inverse of rotations matrix
    // inverse_matrix = rotateCameraMatrixInverse * translateCameraMatrixInverse
    // world_to_camera_matrix
    return [
        [r[0][0], r[1][0], r[2][0], -t.x],
        [r[0][1], r[1][1], r[2][1], -t.y],
        [r[0][2], r[1][2], r[2][2], -t.z],
        [0, 0, 0, 1],
    ]
}
const getProjectedPoint = (point, projectionConstant) => {
    return new Vector(
        (point.x / point.z) * projectionConstant,
        (point.y / point.z) * projectionConstant,
        projectionConstant,
        point.name
    )
}

const renderCube = (cube, cubeWrtCameraMatrix, projectionConstant) => {
    let projectedPoints = []
    cube.points.forEach(point => {
        const transformedPoint = point.getTransformedPoint(cubeWrtCameraMatrix)
        const projectedPoint = getProjectedPoint(transformedPoint, projectionConstant)
        projectedPoints.push(projectedPoint)
    })

    return projectedPoints
}

// RENDER SCENE

const renderScene = (box, cam) => {
    const Z_TRANSLATE_OFFSET = 5
    const PROJECTION_CONSTANT = 300 * cam.zoom
    const CAMERA_POSITION = new Vector(cam.tx, cam.ty, cam.tz + Z_TRANSLATE_OFFSET)
    const CAMERA_ORIENTATION = new Vector(cam.rx, cam.ry, cam.rz)
    const worldWrtCameraMatrix = getWorldWrtCameraMatrix(
        CAMERA_POSITION,
        CAMERA_ORIENTATION
    )
    // euler orientation rotation
    const r = new Vector(box.rx, box.ry, box.rz)
    // translate vector
    const t = new Vector(box.tx, box.ty, box.tz)
    // scale magnitude
    const s = new Vector(box.sx, box.sy, box.sz)

    const cube = new Cube(r, s, t)
    const cubeWrtCameraMatrix = multiply4x4(worldWrtCameraMatrix, cube.wrtWorldMatrix)
    const projectedPoints = renderCube(cube, cubeWrtCameraMatrix, PROJECTION_CONSTANT)
    return projectedPoints
}

/*
   E4------F5      y
   |`.    | `.     |
   |  `A0-----B1   *----- x
   |   |  |   |     \
   G6--|--H7  |      \
    `. |   `. |       z
      `C2-----D3
*/
const drawBox = p => {
    const container = {
        color: "#333333",
        opacity: 1.0,
        xRange: 600,
        yRange: 600,
    }

    const frontPlane = {
        x: [p[0].x, p[1].x, p[3].x, p[2].x],
        y: [p[0].y, p[1].y, p[3].y, p[2].y],
        borderColor: "#00BCD4",
        borderOpacity: 1.0,
        fillColor: "#E91E63",
        fillOpacity: 0.1,
        borderSize: 10,
        type: "polygon",
        id: "front-plane",
    }

    const frontPoints = {
        x: [p[0].x, p[1].x, p[3].x, p[2].x],
        y: [p[0].y, p[1].y, p[3].y, p[2].y],
        color: "#00BCD4",
        opacity: 1.0,
        size: 15,
        type: "points",
        id: "front-points",
    }

    const backPlane = {
        x: [p[5].x, p[7].x, p[6].x, p[4].x],
        y: [p[5].y, p[7].y, p[6].y, p[4].y],
        borderColor: "#00BCD4",
        borderOpacity: 1.0,
        fillColor: "#8BC34A",
        fillOpacity: 0.1,
        borderSize: 10,
        type: "polygon",
        id: "back-plane",
    }

    const connectingLines = {
        x0: [p[0].x, p[1].x, p[2].x, p[3].x],
        y0: [p[0].y, p[1].y, p[2].y, p[3].y],
        x1: [p[4].x, p[5].x, p[6].x, p[7].x],
        y1: [p[4].y, p[5].y, p[6].y, p[7].y],
        color: "#00BCD4",
        opacity: 1.0,
        size: 10,
        type: "lines",
        id: "frontplane",
    }

    const backPoints = {
        x: [p[5].x, p[7].x, p[6].x, p[4].x],
        y: [p[5].y, p[7].y, p[6].y, p[4].y],
        color: "#00BCD4",
        opacity: 1.0,
        size: 15,
        type: "points",
        id: "back-points",
    }
    const data = [frontPlane, connectingLines, backPlane, frontPoints, backPoints]
    return { data, container }
}

export { Cube, renderScene, drawBox }
