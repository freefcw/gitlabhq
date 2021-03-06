# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Awardable do
  let!(:issue)        { create(:issue) }
  let!(:award_emoji)  { create(:award_emoji, :downvote, awardable: issue) }

  describe "Associations" do
    subject { build(:issue) }

    it { is_expected.to have_many(:award_emoji).dependent(:destroy) }
  end

  describe "ClassMethods" do
    let!(:issue2) { create(:issue) }
    let!(:award_emoji2) { create(:award_emoji, awardable: issue2) }

    describe "orders" do
      it "orders on upvotes" do
        expect(Issue.order_upvotes_desc.to_a).to eq [issue2, issue]
      end

      it "orders on downvotes" do
        expect(Issue.order_downvotes_desc.to_a).to eq [issue, issue2]
      end
    end

    describe "#awarded" do
      it "filters by user and emoji name" do
        expect(Issue.awarded(award_emoji.user, "thumbsup")).to be_empty
        expect(Issue.awarded(award_emoji.user, "thumbsdown")).to eq [issue]
        expect(Issue.awarded(award_emoji2.user, "thumbsup")).to eq [issue2]
        expect(Issue.awarded(award_emoji2.user, "thumbsdown")).to be_empty
      end

      it "filters by user and any emoji" do
        issue3 = create(:issue)
        create(:award_emoji, awardable: issue3, name: "star", user: award_emoji.user)
        create(:award_emoji, awardable: issue3, name: "star", user: award_emoji2.user)

        expect(Issue.awarded(award_emoji.user)).to contain_exactly(issue, issue3)
        expect(Issue.awarded(award_emoji2.user)).to contain_exactly(issue2, issue3)
      end
    end

    describe "#not_awarded" do
      it "returns issues not awarded by user" do
        expect(Issue.not_awarded(award_emoji.user)).to eq [issue2]
        expect(Issue.not_awarded(award_emoji2.user)).to eq [issue]
      end
    end
  end

  describe "#upvotes" do
    it "counts the number of upvotes" do
      expect(issue.upvotes).to be 0
    end
  end

  describe "#downvotes" do
    it "counts the number of downvotes" do
      expect(issue.downvotes).to be 1
    end
  end

  describe '#user_can_award?' do
    let(:user) { create(:user) }

    before do
      issue.project.add_guest(user)
    end

    it 'is truthy when the user is allowed to award emoji' do
      expect(issue.user_can_award?(user)).to be_truthy
    end

    it 'is falsy when the project is archived' do
      issue.project.update!(archived: true)

      expect(issue.user_can_award?(user)).to be_falsy
    end
  end

  describe 'querying award_emoji on an Awardable' do
    let(:issue) { create(:issue) }

    it 'sorts in ascending fashion' do
      create_list(:award_emoji, 3, awardable: issue)

      expect(issue.award_emoji).to eq issue.award_emoji.sort_by(&:id)
    end
  end

  describe "#grouped_awards" do
    context 'default award emojis' do
      let(:issue_without_downvote) { create(:issue) }
      let(:issue_with_downvote) do
        issue_with_downvote = create(:issue)
        create(:award_emoji, :downvote, awardable: issue_with_downvote)
        issue_with_downvote
      end

      it "includes unused thumbs buttons by default" do
        expect(issue_without_downvote.grouped_awards.keys.sort).to eq %w(thumbsdown thumbsup)
      end

      it "doesn't include unused thumbs buttons when disabled in project" do
        issue_without_downvote.project.show_default_award_emojis = false

        expect(issue_without_downvote.grouped_awards.keys.sort).to eq []
      end

      it "includes unused thumbs buttons when enabled in project" do
        issue_without_downvote.project.show_default_award_emojis = true

        expect(issue_without_downvote.grouped_awards.keys.sort).to eq %w(thumbsdown thumbsup)
      end

      it "doesn't include unused thumbs buttons in summary" do
        expect(issue_without_downvote.grouped_awards(with_thumbs: false).keys).to eq []
      end

      it "includes used thumbs buttons when disabled in project" do
        issue_with_downvote.project.show_default_award_emojis = false

        expect(issue_with_downvote.grouped_awards.keys).to eq %w(thumbsdown)
      end

      it "includes used thumbs buttons in summary" do
        expect(issue_with_downvote.grouped_awards(with_thumbs: false).keys).to eq %w(thumbsdown)
      end
    end
  end
end
