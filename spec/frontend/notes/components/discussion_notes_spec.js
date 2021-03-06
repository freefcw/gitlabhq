import { shallowMount } from '@vue/test-utils';
import { getByRole } from '@testing-library/dom';
import '~/behaviors/markdown/render_gfm';
import { SYSTEM_NOTE } from '~/notes/constants';
import DiscussionNotes from '~/notes/components/discussion_notes.vue';
import NoteableNote from '~/notes/components/noteable_note.vue';
import PlaceholderNote from '~/vue_shared/components/notes/placeholder_note.vue';
import PlaceholderSystemNote from '~/vue_shared/components/notes/placeholder_system_note.vue';
import SystemNote from '~/vue_shared/components/notes/system_note.vue';
import createStore from '~/notes/stores';
import { noteableDataMock, discussionMock, notesDataMock } from '../mock_data';

const LINE_RANGE = {};
const DISCUSSION_WITH_LINE_RANGE = {
  ...discussionMock,
  position: {
    line_range: LINE_RANGE,
  },
};

describe('DiscussionNotes', () => {
  let store;
  let wrapper;

  const getList = () => getByRole(wrapper.element, 'list');
  const createComponent = (props, features = {}) => {
    wrapper = shallowMount(DiscussionNotes, {
      store,
      propsData: {
        discussion: discussionMock,
        isExpanded: false,
        shouldGroupReplies: false,
        ...props,
      },
      scopedSlots: {
        footer: '<p slot-scope="{ showReplies }">showReplies:{{showReplies}}</p>',
      },
      slots: {
        'avatar-badge': '<span class="avatar-badge-slot-content" />',
      },
      provide: {
        glFeatures: { multilineComments: true, ...features },
      },
    });
  };

  beforeEach(() => {
    store = createStore();
    store.dispatch('setNoteableData', noteableDataMock);
    store.dispatch('setNotesData', notesDataMock);
  });

  afterEach(() => {
    wrapper.destroy();
    wrapper = null;
  });

  describe('rendering', () => {
    it('renders an element for each note in the discussion', () => {
      createComponent();
      const notesCount = discussionMock.notes.length;
      const els = wrapper.findAll(NoteableNote);
      expect(els.length).toBe(notesCount);
    });

    it('renders one element if replies groupping is enabled', () => {
      createComponent({ shouldGroupReplies: true });
      const els = wrapper.findAll(NoteableNote);
      expect(els.length).toBe(1);
    });

    it('uses proper component to render each note type', () => {
      const discussion = { ...discussionMock };
      const notesData = [
        // PlaceholderSystemNote
        {
          id: 1,
          isPlaceholderNote: true,
          placeholderType: SYSTEM_NOTE,
          notes: [{ body: 'PlaceholderSystemNote' }],
        },
        // PlaceholderNote
        {
          id: 2,
          isPlaceholderNote: true,
          notes: [{ body: 'PlaceholderNote' }],
        },
        // SystemNote
        {
          id: 3,
          system: true,
          note: 'SystemNote',
        },
        // NoteableNote
        discussion.notes[0],
      ];
      discussion.notes = notesData;
      createComponent({ discussion, shouldRenderDiffs: true });
      const notes = wrapper.findAll('.notes > *');

      expect(notes.at(0).is(PlaceholderSystemNote)).toBe(true);
      expect(notes.at(1).is(PlaceholderNote)).toBe(true);
      expect(notes.at(2).is(SystemNote)).toBe(true);
      expect(notes.at(3).is(NoteableNote)).toBe(true);
    });

    it('renders footer scoped slot with showReplies === true when expanded', () => {
      createComponent({ isExpanded: true });
      expect(wrapper.text()).toMatch('showReplies:true');
    });

    it('renders footer scoped slot with showReplies === false when collapsed', () => {
      createComponent({ isExpanded: false });
      expect(wrapper.text()).toMatch('showReplies:false');
    });

    it('passes down avatar-badge slot content', () => {
      createComponent();
      expect(wrapper.find('.avatar-badge-slot-content').exists()).toBe(true);
    });
  });

  describe('events', () => {
    describe('with groupped notes and replies expanded', () => {
      const findNoteAtIndex = index => {
        const noteComponents = [NoteableNote, SystemNote, PlaceholderNote, PlaceholderSystemNote];
        const allowedNames = noteComponents.map(c => c.name);
        return wrapper
          .findAll('.notes *')
          .filter(w => allowedNames.includes(w.name()))
          .at(index);
      };

      beforeEach(() => {
        createComponent({ shouldGroupReplies: true, isExpanded: true });
      });

      it('emits deleteNote when first note emits handleDeleteNote', () => {
        findNoteAtIndex(0).vm.$emit('handleDeleteNote');

        return wrapper.vm.$nextTick().then(() => {
          expect(wrapper.emitted().deleteNote).toBeTruthy();
        });
      });

      it('emits startReplying when first note emits startReplying', () => {
        findNoteAtIndex(0).vm.$emit('startReplying');

        return wrapper.vm.$nextTick().then(() => {
          expect(wrapper.emitted().startReplying).toBeTruthy();
        });
      });

      it('emits deleteNote when second note emits handleDeleteNote', () => {
        findNoteAtIndex(1).vm.$emit('handleDeleteNote');

        return wrapper.vm.$nextTick().then(() => {
          expect(wrapper.emitted().deleteNote).toBeTruthy();
        });
      });
    });

    describe('with ungroupped notes', () => {
      let note;
      beforeEach(() => {
        createComponent();
        note = wrapper.find('.notes > *');
      });

      it('emits deleteNote when first note emits handleDeleteNote', () => {
        note.vm.$emit('handleDeleteNote');

        return wrapper.vm.$nextTick().then(() => {
          expect(wrapper.emitted().deleteNote).toBeTruthy();
        });
      });
    });
  });

  describe.each`
    desc                               | props                                         | features                        | event           | expectedCalls
    ${'with `discussion.position`'}    | ${{ discussion: DISCUSSION_WITH_LINE_RANGE }} | ${{}}                           | ${'mouseenter'} | ${[['setSelectedCommentPositionHover', LINE_RANGE]]}
    ${'with `discussion.position`'}    | ${{ discussion: DISCUSSION_WITH_LINE_RANGE }} | ${{}}                           | ${'mouseleave'} | ${[['setSelectedCommentPositionHover']]}
    ${'with `discussion.position`'}    | ${{ discussion: DISCUSSION_WITH_LINE_RANGE }} | ${{ multilineComments: false }} | ${'mouseenter'} | ${[]}
    ${'with `discussion.position`'}    | ${{ discussion: DISCUSSION_WITH_LINE_RANGE }} | ${{ multilineComments: false }} | ${'mouseleave'} | ${[]}
    ${'without `discussion.position`'} | ${{}}                                         | ${{}}                           | ${'mouseenter'} | ${[]}
    ${'without `discussion.position`'} | ${{}}                                         | ${{}}                           | ${'mouseleave'} | ${[]}
  `('$desc and features $features', ({ props, event, features, expectedCalls }) => {
    beforeEach(() => {
      createComponent(props, features);
      jest.spyOn(store, 'dispatch');
    });

    it(`calls store ${expectedCalls.length} times on ${event}`, () => {
      getList().dispatchEvent(new MouseEvent(event));
      expect(store.dispatch.mock.calls).toEqual(expectedCalls);
    });
  });

  describe('componentData', () => {
    beforeEach(() => {
      createComponent();
    });

    it('should return first note object for placeholder note', () => {
      const data = {
        isPlaceholderNote: true,
        notes: [{ body: 'hello world!' }],
      };
      const note = wrapper.vm.componentData(data);

      expect(note).toEqual(data.notes[0]);
    });

    it('should return given note for nonplaceholder notes', () => {
      const data = {
        notes: [{ id: 12 }],
      };
      const note = wrapper.vm.componentData(data);

      expect(note).toEqual(data);
    });
  });
});
