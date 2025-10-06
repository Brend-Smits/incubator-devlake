package migrationscripts

import (
	"github.com/apache/incubator-devlake/core/context"
	"github.com/apache/incubator-devlake/core/errors"
	"github.com/apache/incubator-devlake/core/plugin"
)

var _ plugin.MigrationScript = (*backfillPipelinePriority)(nil)

type backfillPipelinePriority struct{}

func (*backfillPipelinePriority) Up(basicRes context.BasicRes) errors.Error {
	db := basicRes.GetDal()
	if err := db.Exec("UPDATE _devlake_pipelines SET priority = 0 WHERE priority IS NULL"); err != nil {
		return err
	}
	if err := db.Exec("UPDATE _devlake_blueprints SET priority = 0 WHERE priority IS NULL"); err != nil {
		return err
	}
	return nil
}

func (*backfillPipelinePriority) Version() uint64 {
	return 20251006091530
}

func (*backfillPipelinePriority) Name() string {
	return "backfill null priorities for pipelines and blueprints"
}
