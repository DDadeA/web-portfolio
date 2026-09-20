import * as twgl from "../../modules/twgl-full.module.js";

async function getFile(file) {
  return fetch(file).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load file: ${file}`);
    }

    return response.text();
  });
}

const header = document.querySelector("header");
if (!header) throw new Error("Header element not found in the DOM.");

const width = window.innerWidth;
const height = window.innerHeight * 0.7;

const canvas = document.createElement("canvas");
canvas.width = width;
canvas.height = height;
header.appendChild(canvas);

console.log(width, height);

const gl = canvas.getContext("webgl2");

const ext = gl.getExtension("EXT_color_buffer_float");
if (!ext) {
  throw new Error(
    "32-bit float render targets are not supported on this GPU/browser.",
  );
}

const betterRGBA = {
  internalFormat: gl.RGBA32F,
  min: gl.NEAREST,
  mag: gl.NEAREST,
  attachmentPoint: gl.COLOR_ATTACHMENT0,
};

const vs = `#version 300 es

  uniform vec2 u_resolution;

  in vec2 position;
  out vec2 uv;
  
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const planeQuad = {
  position: {
    data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
    numComponents: 2,
  },
};
const QuadBufferInfo = twgl.createBufferInfoFromArrays(gl, planeQuad);

function drawPass(
  programInfo,
  uniforms,
  fbo = null,
  bufferInfo = QuadBufferInfo,
) {
  twgl.bindFramebufferInfo(gl, fbo);
  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);
}

const rayMarcherBufferUpscale = 1.5;

const rayMarcherBuffer = twgl.createFramebufferInfo(
  gl,
  [
    betterRGBA, // 3D Ray Direction and material ID
    { ...betterRGBA, attachmentPoint: gl.COLOR_ATTACHMENT1 }, // Superfical Normal, object hit
    {
      internalFormat: gl.R32F,
      format: gl.RED,
      type: gl.FLOAT,
      min: gl.NEAREST,
      mag: gl.NEAREST,
      attachmentPoint: gl.COLOR_ATTACHMENT2,
    },
    { ...betterRGBA, attachmentPoint: gl.COLOR_ATTACHMENT3 }, // For low IOR setup
  ],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);

const rayMarcherBuffer2 = twgl.createFramebufferInfo(
  gl,
  [
    betterRGBA, // 3D Ray Direction and material ID
    { ...betterRGBA, attachmentPoint: gl.COLOR_ATTACHMENT1 }, // Superfical Normal, object hit
    {
      internalFormat: gl.R32F,
      format: gl.RED,
      type: gl.FLOAT,
      min: gl.NEAREST,
      mag: gl.NEAREST,
      attachmentPoint: gl.COLOR_ATTACHMENT2,
    },
    { ...betterRGBA, attachmentPoint: gl.COLOR_ATTACHMENT3 }, // For low IOR setup
  ],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);

const ppBuffers = [twgl.createFramebufferInfo(gl, [betterRGBA])];
const renderBuffer = twgl.createFramebufferInfo(
  gl,
  [{}],
  width * rayMarcherBufferUpscale,
  height * rayMarcherBufferUpscale,
);

const backgroundTexture = twgl.createTexture(gl, {
  src: "src/headers/260906/bg.jpg",
  flipY: true,
});

const cubeMapTexture = twgl.createTexture(gl, {
  target: gl.TEXTURE_CUBE_MAP,
  src: [
    "src/headers/260906/cubemap/posx.jpg",
    "src/headers/260906/cubemap/negx.jpg",
    "src/headers/260906/cubemap/posy.jpg",
    "src/headers/260906/cubemap/negy.jpg",
    "src/headers/260906/cubemap/posz.jpg",
    "src/headers/260906/cubemap/negz.jpg",
  ],
});

const pi_rayMarcher = twgl.createProgramInfo(gl, [
  vs,
  await getFile("src/headers/260906/shaders/rayMarcher.frag"),
]);

const pi_disperse = twgl.createProgramInfo(gl, [
  vs,
  await getFile("src/headers/260906/shaders/disperse.frag"),
]);

const pi_showBuffer = twgl.createProgramInfo(gl, [
  vs,
  `#version 300 es
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform sampler2D u_sampler;

  in vec2 uv;
  out vec4 fragColor;
  
  void main() {
    vec4 c = texture(u_sampler, uv);
    // fragColor = vec4(log(c.rgb + 1.0)/2.7/3.0, 1.0);
    fragColor = abs(c);
  }`,
]);

function getRotation() {
  // get mouse position
  const mouseX = window.mouseX || performance.now() * 0.1;
  const mouseY = window.mouseY || performance.now() * 0.05;

  // get rotation based on mouse position
  const rotationX = (mouseY / window.innerHeight) * Math.PI * 2;
  const rotationY = (mouseX / window.innerWidth) * Math.PI * 2;

  return [rotationX, rotationY, 0];
}

let lastFrame = 0;
let avgFPS = 0;
function render() {
  // Initialize per frame
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Drawcalls
  const uniform = {
    u_cameraPos: [10, 0, 0], // xyz, z is the height
    u_fov: 80.0,
    u_pointing: [0, 0, 0],
    u_aspectRatio: gl.canvas.width / gl.canvas.height,
    u_time: performance.now() * 0.001,

    u_objectRotation: getRotation(),
    u_objectScale: 1.0,
    u_objectPosition: [0, 0, 0],

    u_eps: 1e-4,
    u_IOR: 1.4,
    u_lowIOR: 1.2,
  };

  drawPass(pi_rayMarcher, uniform, rayMarcherBuffer);
  drawPass(pi_rayMarcher, { ...uniform, u_IOR: 1.2 }, rayMarcherBuffer2);

  drawPass(
    pi_disperse,
    {
      u_resolution: [gl.canvas.width, gl.canvas.height],
      u_time: performance.now() * 0.001,

      backgroundSampler: cubeMapTexture,
      highIORSampler: rayMarcherBuffer.attachments[0],
      lowIORSampler: rayMarcherBuffer2.attachments[0],
      // lowIORSampler: rayMarcherBuffer_lights[0].attachments[0],
    },
    renderBuffer,
  );

  // Show the framebuffer on the screen
  drawPass(pi_showBuffer, {
    u_resolution: [gl.canvas.width, gl.canvas.height],
    u_time: performance.now() * 0.001,
    u_sampler: renderBuffer.attachments[0],
    // u_sampler: rayMarcherBuffer.attachments[3],
  });

  avgFPS = 0.9 * avgFPS + 0.1 * (1000 / (performance.now() - lastFrame));
  document.title = `${avgFPS.toFixed(1)} FPS`;
  lastFrame = performance.now();

  // Recurse
  requestAnimationFrame(render);
}
render();

// WHY NOISY?
// -- // normal or eps is not the problem. surface normal looks super smooth.
// -- // But the refracted normal does.
