"""add profile_picture to user

Revision ID: 2eea7d36c67d
Revises: 2fc1da63dade
Create Date: 2026-05-09 20:25:40.242647

"""
from alembic import op
import sqlalchemy as sa

revision = '2eea7d36c67d'
down_revision = '2fc1da63dade'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('profile_picture', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('users', 'profile_picture')