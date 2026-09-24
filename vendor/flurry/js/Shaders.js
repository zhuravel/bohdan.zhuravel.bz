// BZ ADDITION (not part of upstream Flurry-WebGL): upstream ships its two GLSL
// programs as inline <script id="vertexShader">/<script id="fragShader"> tags in
// index.html, which Renderer.prototype.useShader(id) reads via
// document.getElementById(id).innerHTML. We can't add markup to the host page, so
// this file injects the same two DOM nodes at load time instead, with the shader
// source copied byte-for-byte from Flurry-WebGL's index.html <shaders> block.
// Renderer.useShader() itself is untouched.
(function()
{
  function inject(id, type, source)
  {
    var el  = document.createElement('script');
    el.id   = id;
    el.type = type;
    el.text = source;
    document.head.appendChild(el);
  }

  inject('vertexShader', 'x-shader/x-vertex', [
    'precision highp float;',
    'precision highp int;',
    '',
    'attribute vec2 position;',
    'attribute vec4 color;',
    'attribute vec2 uv;',
    '',
    'uniform mat4 modelViewMatrix;',
    'uniform mat4 projectionMatrix;',
    '',
    'varying vec4 vColor;',
    'varying vec2 vUv;',
    '',
    'void main()',
    '{',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0, 1.0);',
    '',
    '    vColor = color;',
    '    vUv    = uv;',
    '}'
  ].join('\n'));

  inject('fragShader', 'x-shader/x-fragment', [
    'precision highp float;',
    'precision highp int;',
    '',
    'varying vec4 vColor;',
    'varying vec2 vUv;',
    '',
    'uniform bool drawingRect;',
    '',
    'uniform sampler2D uSampler;',
    '',
    'void main()',
    '{',
    '    if (drawingRect)',
    '        gl_FragColor = vColor;',
    '    else',
    '    {',
    '        vec4 texel = texture2D(uSampler, vec2(vUv.s, vUv.t));',
    '',
    '        gl_FragColor = vec4(texel) * vColor;',
    '        if (gl_FragColor.a < 0.0)',
    '            discard;',
    '    }',
    '}'
  ].join('\n'));
})();
