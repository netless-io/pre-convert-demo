import TinyOSS from 'tiny-oss';
import { v1 as uuidv1 } from 'uuid';
import './i18n';
import './main.css';
import { createSdkToken, TokenRole } from './utils';

window.TinyOSS = TinyOSS;

const _ = document;
const $ = __ => _.querySelector(__);

function filterObject(obj) {
  const result = {};
  for (const key in obj) {
    if (obj[key]) result[key] = obj[key];
  }
  return result;
}

$('#oss-form').addEventListener('input', e => {
  if (!$('#bucket').value) {
    $('#file-url').value = 'missing bucket';
  } else if (!$('#object').value) {
    $('#file-url').value = 'missing object';
  } else {
    $('#file-url').value =
      'http://' +
      $('#bucket').value +
      '.' +
      ($('#region').value || 'oss-cn-hangzhou') +
      '.aliyuncs.com/' +
      $('#object').value;
    $('#file-url-2').value = $('#file-url').value;
  }
});

$('#oss-form').addEventListener('submit', e => {
  e.preventDefault();
  const object = $('#object').value;
  const file = $('#file').files[0];
  const progress = $('#oss-progress');
  if (!object || !file) {
    window.alert('Please provide object name and file.');
    return;
  }
  try {
    const oss = new TinyOSS(
      filterObject({
        accessKeyId: $('#accessKeyId').value,
        accessKeySecret: $('#accessKeySecret').value,
        stsToken: $('#stsToken').value,
        region: $('#region').value,
        bucket: $('#bucket').value
      })
    );
    oss.put(object, file, {
      onprogress(e) {
        progress.value = e.loaded;
        progress.max = e.total;
      }
    });
  } catch (error) {
    window.alert('TinyOSS Error: ' + error.message);
    console.error(error);
  }
});

function updateButtonGenDisabled() {
  $('#gen').disabled = !Boolean($('#ak').value) || !Boolean($('#sk').value);
}

$('#ak').addEventListener('input', updateButtonGenDisabled);
$('#sk').addEventListener('input', updateButtonGenDisabled);

$('#gen').addEventListener('click', async e => {
  e.preventDefault();
  const ak = $('#ak').value;
  const sk = $('#sk').value;
  const ms = $('#ms').value;
  const token = await createSdkToken(ak, sk, ms, { role: TokenRole.Admin });
  $('#sdkToken').value = token;
});

$('#toggle-modal-gen').addEventListener('click', e => {
  e.preventDefault();
  if ($('#modal-gen').style.display === 'none') {
    $('#modal-gen').style.display = 'block';
  } else {
    $('#modal-gen').style.display = 'none';
  }
});

$('#convert-form').addEventListener('submit', async e => {
  e.preventDefault();
  const sdkToken = $('#sdkToken').value;
  const fileUrl = $('#file-url-2').value;
  const convertType = $('#type').value;
  if (!sdkToken || !fileUrl) {
    window.alert('Please provite sdk token and file url.');
    return;
  }
  try {
    const res = await fetch(
      'https://api.netless.link/v5/services/conversion/tasks',
      {
        method: 'POST',
        headers: {
          token: sdkToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resource: fileUrl,
          type: convertType,
          preview: true
        })
      }
    ).then(r => r.json());
    startPollingTask(res);
  } catch (error) {
    window.alert('Convert Error: ' + error.message);
    console.error(error);
  }
});

function delay(ms) {
  return new Promise(r => {
    setTimeout(r, ms);
  });
}

let convertType;

async function startPollingTask({ uuid, type, status }) {
  convertType = type;
  const sdkToken = $('#sdkToken').value;

  $('#uuid').textContent = uuid;
  $('#status').textContent = status;

  try {
    const taskToken = await fetch(
      'https://api.netless.link/v5/tokens/tasks/' + uuid,
      {
        method: 'POST',
        headers: {
          token: sdkToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lifespan: 10 * 60 * 1000,
          role: 'reader'
        })
      }
    ).then(r => r.json());

    let status = 'Waiting';
    while (status !== 'Finished' && status !== 'Fail') {
      const res = await fetch(
        `https://api.netless.link/v5/services/conversion/tasks/${uuid}?type=${type}`,
        {
          headers: {
            token: taskToken,
            'Content-Type': 'application/json'
          }
        }
      ).then(r => r.json());
      status = res.status;
      $('#status').textContent = res.status;
      $('#step').textContent = res.progress.currentStep;
      const converted = res.progress.convertedPageSize;
      const total = res.progress.totalPageSize;
      $('#progress').value = converted;
      $('#progress').max = total;
      refreshResult(res.progress.convertedFileList);
      await delay(1000);
    }
  } catch (error) {
    window.alert('Create task token error: ' + error.message);
    console.error(error);
  }
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const key in attrs) el[key] = attrs[key];
  el.append(...children);
  return el;
}

function refreshResult(array) {
  $('#result').innerHTML = '';
  let i = 0;
  for (let { width, height, conversionFileUrl, preview } of array) {
    if (convertType === 'static') preview = conversionFileUrl;
    const checkbox = h('input', { type: 'checkbox' });
    checkbox.dataset.i = String(i);
    checkbox.id = 'result-' + i;
    const previewSpan = h(
      'span',
      { className: 'underline pointer' },
      '(preview)'
    );
    function showPreview() {
      if (!preview) return;
      $('#preview img').src = '';
      $('#preview img').src = preview;
      $('#preview').style.display = '';
    }
    function hidePreview() {
      if (!preview) return;
      $('#preview').style.display = 'none';
    }
    previewSpan.addEventListener('mouseenter', showPreview);
    previewSpan.addEventListener('mousehover', showPreview);
    previewSpan.addEventListener('mouseleave', hidePreview);
    const label = h(
      'label',
      { for: checkbox.id, className: 'flex relative' },
      ...[
        h(
          'span',
          { className: 'flex-auto' },
          `${conversionFileUrl} (${width}x${height})`
        ),
        preview ? previewSpan : null
      ].filter(Boolean)
    );
    checkbox.addEventListener('input', () => {
      let lines = $('#scenes').value.split('\n');
      lines = lines.filter(l => l !== conversionFileUrl);
      if (checkbox.checked) lines.push(conversionFileUrl);
      $('#scenes').value = lines.join('\n');
    });
    $('#result').append(checkbox, label);
    i++;
  }
}

function uniq(array) {
  return Array.from(new Set(array));
}

$('#fetch-scenes').addEventListener('click', async e => {
  e.preventDefault();
  const token = $('#roomToken').value;
  const uuid = $('#roomUuid').value;

  if (!token || !uuid) {
    window.alert('Please provide room token and room uuid');
    return;
  }

  try {
    const scenes = await fetch(
      'https://api.netless.link/v5/rooms/' + uuid + '/scenes',
      {
        headers: {
          token,
          'Content-Type': 'application/json'
        }
      }
    ).then(r => r.json());
    $('#jump-to').innerHTML = '';
    $('#jump-to').append(...scenes.map(e => h('option', { value: e }, e)));

    const paths = uniq(
      scenes.map(e => {
        const parts = e.split('/');
        parts.pop();
        return parts.map(p => p + '/').join('');
      })
    );

    $('#path').innerHTML = '';
    $('#path').append(...paths.map(e => h('option', { value: e }, e)));
  } catch (error) {
    window.alert('Fetch scenes error: ' + error.message);
    console.error(error);
  }
});

$('#scenes-form').addEventListener('submit', async e => {
  e.preventDefault();
  const token = $('#roomToken').value;
  const uuid = $('#roomUuid').value;
  const path = $('#path').value;

  if (!token || !uuid || !path) {
    window.alert('Please provide room token and room uuid and path');
    return;
  }

  const scenes = $('#scenes')
    .value.split('\n')
    .filter(Boolean)
    .map((e, i) => ({
      name: uuidv1(),
      ppt: {
        src: e,
        width: 1024,
        height: 768
      }
    }));

  try {
    await fetch('https://api.netless.link/v5/rooms/' + uuid + '/scenes', {
      method: 'POST',
      headers: {
        token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scenes,
        path
      })
    }).then(r => r.json());
    window.alert('Done.');
  } catch (error) {
    window.alert('Insert scene error: ' + error.message);
    console.error(error);
  }
});

$('#jump').addEventListener('click', async e => {
  e.preventDefault();
  const token = $('#roomToken').value;
  const uuid = $('#roomUuid').value;

  if (!token || !uuid) {
    window.alert('Please provide room token and room uuid');
    return;
  }

  const target = $('#jump-to').value;

  if (!target) {
    window.alert('Please provide jump to tagret');
    return;
  }

  try {
    await fetch('https://api.netless.link/v5/rooms/' + uuid + '/scene-state', {
      method: 'PATCH',
      headers: {
        token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scenePath: target
      })
    }).then(r => r.json());
    window.alert('Done.');
  } catch (error) {
    window.alert('Insert scene error: ' + error.message);
    console.error(error);
  }
});
