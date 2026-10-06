// A single texture pass uses RetroArch's existing GL renderer.
export const displayShader = `
#ifdef VERTEX
attribute vec4 VertexCoord;
attribute vec2 TexCoord;
uniform mat4 MVPMatrix;
varying vec2 vTexCoord;
void main() {
  gl_Position = MVPMatrix * VertexCoord;
  vTexCoord = TexCoord;
}
#elif defined(FRAGMENT)
#ifdef GL_ES
precision mediump float;
#endif
uniform sampler2D Texture;
varying vec2 vTexCoord;
void main() {
  gl_FragColor = texture2D(Texture, vTexCoord);
}
#endif
`;

export function displayPreset(smooth:boolean) {
  return `shaders = "1"\nshader0 = "display.glsl"\nfilter_linear0 = "${smooth}"\n`;
}
