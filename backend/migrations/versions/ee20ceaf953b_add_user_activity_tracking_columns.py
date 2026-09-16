"""add user activity tracking columns

These columns (is_active, last_login, is_online, last_seen) already
existed on the live database -- they were added out-of-band at some
point and never had a migration committed for them. This migration
exists so a fresh database (e.g. local dev) ends up with the same
schema the live one already has.

Revision ID: ee20ceaf953b
Revises: efb3863ec55a
Create Date: 2026-09-16 07:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ee20ceaf953b'
down_revision = 'efb3863ec55a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('last_login', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('is_online', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('last_seen', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('last_seen')
        batch_op.drop_column('is_online')
        batch_op.drop_column('last_login')
        batch_op.drop_column('is_active')
