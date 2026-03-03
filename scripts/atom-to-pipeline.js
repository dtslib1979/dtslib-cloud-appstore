/**
 * atom-to-pipeline.js — OrbitPrompt Atom → Pipeline Spec 변환
 * 브라우저/Node 양용
 */
(function(root) {
  'use strict';

  // 태그 → 카테고리 매핑
  var TAG_TO_CAT = {
    video: 'video', editing: 'video', shorts: 'video', lecture: 'video',
    audio: 'audio', music: 'audio', bgm: 'audio', sound: 'audio',
    image: 'image', photo: 'image', lens: 'image', pack: 'image',
    util: 'util', tool: 'util', manager: 'util', aligner: 'util',
    game: 'game', quiz: 'game', tutor: 'game', curation: 'game'
  };

  /**
   * Atom JSON → Pipeline Spec 변환
   * @param {Object} atom - OrbitPrompt atom 형식
   * @param {string} atom.title - 도구 이름
   * @param {string[]} [atom.tags] - 태그 배열
   * @param {string} [atom.body] - 설명
   * @returns {Object} Pipeline spec
   */
  function atomToPipelineSpec(atom) {
    if (!atom || !atom.title) {
      throw new Error('atom.title 필수');
    }

    // title → name (케밥케이스)
    var name = atom.title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // tags → category
    var category = 'util';
    if (atom.tags && Array.isArray(atom.tags)) {
      for (var i = 0; i < atom.tags.length; i++) {
        var tag = atom.tags[i].toLowerCase();
        if (TAG_TO_CAT[tag]) {
          category = TAG_TO_CAT[tag];
          break;
        }
      }
    }

    // type 추론 (video 카테고리면 pwa 후보, 나머지 webapp)
    var type = category === 'video' ? 'pwa' : 'webapp';

    return {
      name: name,
      displayName: atom.title,
      desc: atom.body || atom.title,
      category: category,
      type: type,
      icon: atom.icon || '🔧',
      version: '1.0',
      source: 'atom-bridge'
    };
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { atomToPipelineSpec: atomToPipelineSpec };
  } else {
    root.atomToPipelineSpec = atomToPipelineSpec;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
